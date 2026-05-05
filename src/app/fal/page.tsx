"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n/context";
import { isAdmin } from "@/lib/auth/admin";
import { PremiumModal } from "@/components/PremiumModal";

type ReadingRow = {
  id: string;
  created_at: string;
  full_name: string;
  dob: string | null;
  relationship: "yes" | "no";
  partner_name: string | null;
  photo_count: number;
  fortune_text: string;
  lang: string;
};

const MAX_IMAGES = 10;
const MAX_DIMENSION = 1280;
const MAX_BYTES = 1.6 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function downscaleImage(file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  if (file.size < MAX_BYTES) return dataUrl;

  return await new Promise<string>((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const ratio = Math.min(
        1,
        MAX_DIMENSION / Math.max(img.width, img.height),
      );
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export default function FalPage() {
  const { t, lang } = useLang();

  const [authChecked, setAuthChecked] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);

  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [relationship, setRelationship] = useState<"no" | "yes">("no");
  const [partnerName, setPartnerName] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ReadingRow[]>([]);
  const [openHistory, setOpenHistory] = useState<ReadingRow | null>(null);

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) return;
      setIsOwner(isAdmin(user.email));

      const { data: prof } = await sb
        .from("profiles")
        .select("is_premium")
        .eq("id", user.id)
        .single();
      const premium = Boolean(prof?.is_premium) || isAdmin(user.email);
      setIsPremium(Boolean(prof?.is_premium));

      if (premium) {
        const { data: rows } = await sb
          .from("fortune_readings")
          .select(
            "id, created_at, full_name, dob, relationship, partner_name, photo_count, fortune_text, lang",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);
        setHistory((rows ?? []) as ReadingRow[]);
      }

      setAuthChecked(true);
    })();
  }, []);

  const allowed = isPremium || isOwner;

  const groupedHistory = useMemo(() => {
    const map = new Map<string, ReadingRow[]>();
    for (const r of history) {
      const key = (r.full_name ?? "—").trim() || "—";
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "tr"));
  }, [history]);

  async function onPickImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      e.target.value = "";
      return;
    }
    const slice = files.slice(0, remaining);
    setBusy(true);
    try {
      const dataUrls = await Promise.all(slice.map((f) => downscaleImage(f)));
      setImages((prev) => [...prev, ...dataUrls].slice(0, MAX_IMAGES));
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submitReading() {
    setError(null);
    setResult("");

    if (!allowed) {
      setError(t.fortune.premiumOnly);
      setPremiumOpen(true);
      return;
    }
    if (!fullName.trim() || !dob) {
      setError(t.fortune.needName);
      return;
    }
    if (images.length === 0) {
      setError(t.fortune.needPhoto);
      return;
    }

    setScanning(true);
    try {
      const res = await fetch("/api/fortune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          dob,
          relationship,
          partnerName: partnerName.trim(),
          images,
          lang,
        }),
      });

      if (!res.ok) {
        let msg = t.diet.calcError;
        try {
          const j = (await res.json()) as { error?: string };
          if (j?.error) msg = j.error;
        } catch {
          // ignore
        }
        setError(msg);
        return;
      }
      if (!res.body) {
        setError(t.diet.calcError);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setResult(acc);
      }

      const sb = createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (user) {
        const { data: rows } = await sb
          .from("fortune_readings")
          .select(
            "id, created_at, full_name, dob, relationship, partner_name, photo_count, fortune_text, lang",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);
        setHistory((rows ?? []) as ReadingRow[]);
      }
    } catch (err) {
      console.log("[fortune] submit error", err);
      setError(t.diet.calcError);
    } finally {
      setScanning(false);
    }
  }

  if (!authChecked) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center text-sm text-purple-700">
        Yükleniyor…
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#1f1145] via-[#2c1a5b] to-[#0f0a2a] text-white">
      <PremiumModal open={premiumOpen} onClose={() => setPremiumOpen(false)} />

      <div className="pointer-events-none absolute -right-32 top-10 h-72 w-72 rounded-full bg-purple-500/30 blur-3xl" />
      <div className="pointer-events-none absolute -left-32 bottom-10 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />

      <div className="relative mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <header className="mb-6 text-center">
          <p className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-purple-200">
            ✨ Falcı Bacı ✨
          </p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{t.fortune.title}</h1>
          <p className="mt-2 text-sm text-purple-200">{t.fortune.subtitle}</p>
        </header>

        {!allowed && (
          <div className="mb-6 rounded-2xl border border-purple-300/30 bg-white/5 p-5 text-center">
            <p className="text-sm text-purple-100">{t.fortune.premiumOnly}</p>
            <button
              type="button"
              onClick={() => setPremiumOpen(true)}
              className="mt-3 rounded-full bg-[#F28C28] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#e07d1f]"
            >
              {t.fortune.premiumCta}
            </button>
          </div>
        )}

        {!openHistory && (
          <div className="space-y-5 rounded-3xl border border-purple-300/20 bg-white/5 p-5 backdrop-blur-sm sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-purple-200">
                  {t.fortune.fullName}
                </label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-purple-300/30 bg-white/10 px-3 py-2.5 text-sm text-white placeholder-purple-300/60 outline-none focus:border-purple-300 focus:ring-1 focus:ring-purple-300/30"
                  placeholder={t.fortune.fullNamePlaceholder}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-purple-200">
                  {t.fortune.dob}
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-purple-300/30 bg-white/10 px-3 py-2.5 text-sm text-white placeholder-purple-300/60 outline-none focus:border-purple-300 focus:ring-1 focus:ring-purple-300/30"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-purple-200">
                  {t.fortune.relationship}
                </label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: "no", label: t.fortune.relNo },
                      { id: "yes", label: t.fortune.relYes },
                    ] as { id: "yes" | "no"; label: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setRelationship(opt.id)}
                      className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-bold transition ${
                        relationship === opt.id
                          ? "border-purple-300 bg-purple-300/20 text-white"
                          : "border-purple-300/30 bg-white/5 text-purple-200 hover:bg-white/10"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {relationship === "yes" && (
                <div>
                  <label className="text-xs font-semibold text-purple-200">
                    {t.fortune.partnerName}
                  </label>
                  <input
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-purple-300/30 bg-white/10 px-3 py-2.5 text-sm text-white placeholder-purple-300/60 outline-none focus:border-purple-300 focus:ring-1 focus:ring-purple-300/30"
                    placeholder={t.fortune.partnerPlaceholder}
                  />
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-purple-200">
                {t.fortune.uploadTitle}
              </p>
              <p className="mt-0.5 text-[11px] text-purple-300/70">{t.fortune.uploadHint}</p>
              <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
                {images.map((src, idx) => (
                  <div key={idx} className="group relative aspect-square overflow-hidden rounded-xl border border-purple-300/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`fal-${idx}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100"
                    >
                      {t.fortune.remove}
                    </button>
                  </div>
                ))}
                {images.length < MAX_IMAGES && (
                  <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-purple-300/40 bg-white/5 text-purple-200 transition hover:border-purple-300 hover:bg-white/10">
                    <span className="text-2xl">+</span>
                    <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider">
                      {t.fortune.uploadButton}
                    </span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={onPickImages}
                      className="hidden"
                      disabled={busy}
                    />
                  </label>
                )}
              </div>
              {busy && (
                <p className="mt-2 text-[11px] text-purple-300">İşleniyor…</p>
              )}
            </div>

            {error && (
              <p className="rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200" role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={submitReading}
              disabled={scanning}
              className="w-full rounded-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-700 py-3 text-sm font-bold text-white shadow-lg shadow-purple-900/30 transition hover:opacity-95 disabled:opacity-60"
            >
              {scanning ? t.fortune.scanning : `🔮 ${t.fortune.askButton}`}
            </button>

            {scanning && !result && (
              <div className="rounded-2xl border border-purple-300/30 bg-white/5 p-5 text-center">
                <div className="mx-auto h-16 w-16 animate-spin rounded-full border-2 border-purple-300 border-t-transparent" />
                <p className="mt-3 text-sm font-semibold text-purple-100">{t.fortune.scanning}</p>
                <p className="mt-1 text-xs text-purple-300">{t.fortune.scanningHint}</p>
              </div>
            )}

            {result && (
              <article className="rounded-2xl border border-purple-300/30 bg-white/5 p-5 text-sm leading-relaxed text-purple-50">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-purple-300">
                    {t.fortune.resultTitle}
                  </p>
                  <span className="text-[11px] text-purple-300/80">
                    {t.fortune.resultMeta}
                  </span>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-purple-50">
                  {result}
                </pre>
              </article>
            )}
          </div>
        )}

        {openHistory && (
          <div className="rounded-3xl border border-purple-300/20 bg-white/5 p-5 backdrop-blur-sm sm:p-6">
            <button
              type="button"
              onClick={() => setOpenHistory(null)}
              className="rounded-full border border-purple-300/40 px-3 py-1.5 text-xs font-semibold text-purple-200 hover:bg-white/10"
            >
              ← {t.fortune.back}
            </button>
            <h2 className="mt-4 text-lg font-bold text-white">
              {openHistory.full_name || "—"}
            </h2>
            <p className="text-xs text-purple-300">
              {new Date(openHistory.created_at).toLocaleString("tr-TR")}
            </p>
            <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-purple-50">
              {openHistory.fortune_text ?? ""}
            </pre>
          </div>
        )}

        {allowed && history.length > 0 && !openHistory && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-purple-300">
              {t.fortune.historyTitle}
            </h2>
            <div className="space-y-4">
              {groupedHistory.map(([name, items]) => (
                <div key={name} className="rounded-2xl border border-purple-300/20 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-purple-100">{name}</p>
                  <p className="text-[11px] text-purple-300/70">
                    {items.length} bakım
                  </p>
                  <div className="mt-3 space-y-2">
                    {items.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setOpenHistory(r)}
                        className="flex w-full items-center justify-between rounded-xl border border-purple-300/20 bg-white/5 px-3 py-2 text-left text-xs transition hover:bg-white/10"
                      >
                        <span className="text-purple-200">
                          {new Date(r.created_at).toLocaleString("tr-TR")}
                        </span>
                        <span className="text-purple-300">{t.fortune.openReading} →</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
