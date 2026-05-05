"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n/context";
import { PremiumModal } from "@/components/PremiumModal";
import { isAdmin } from "@/lib/auth/admin";

type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
type Goal = "kilo_verme" | "kas" | "koruma";
type DietMode = "pantry" | "dietitian";

function cleanDietOutput(text: string): string {
  return text
    .replace(/\\\[/g, "")
    .replace(/\\\]/g, "")
    .replace(/\\times/g, "x")
    .replace(/\\approx/g, "~")
    .replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/^#\s*/gm, "")
    .trim();
}

export default function DiyetPage() {
  const { t, lang } = useLang();
  const [isPremium, setIsPremium] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);

  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [gender, setGender] = useState<"female" | "male">("female");
  const [age, setAge] = useState("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");
  const [goal, setGoal] = useState<Goal>("kilo_verme");

  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<DietMode | null>(null);

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) return;

      setIsOwner(isAdmin(user.email));
      const { data } = await sb
        .from("profiles")
        .select("is_premium")
        .eq("id", user.id)
        .single();
      if (data?.is_premium) setIsPremium(true);
    })();
  }, []);

  function validateAndOpenMode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const h = Number(height.replace(",", "."));
    const w = Number(weight.replace(",", "."));
    const a = Number(age.replace(",", "."));

    const hasInvalid =
      Number.isNaN(h) ||
      Number.isNaN(w) ||
      Number.isNaN(a) ||
      h <= 0 ||
      w <= 0 ||
      a <= 0 ||
      !gender ||
      !activityLevel;

    if (hasInvalid) {
      setError(t.diet.fillFields);
      return;
    }

    if (!(isPremium || isOwner)) {
      setError(t.diet.premiumOnly);
      setPremiumOpen(true);
      return;
    }

    setModeOpen(true);
  }

  async function runMode(mode: DietMode, regenerate = false) {
    setModeOpen(false);
    setError(null);
    setResult("");
    setActiveMode(mode);

    const h = Number(height.replace(",", "."));
    const w = Number(weight.replace(",", "."));
    const a = Number(age.replace(",", "."));

    setLoading(true);
    console.log("[diet] submit payload", { mode, regenerate });

    try {
      const res = await fetch("/api/diet-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          height: h,
          weight: w,
          age: a,
          gender,
          activityLevel,
          goal,
          lang,
          mode,
          regenerate,
        }),
      });

      console.log("[diet] api status", res.status);

      if (!res.ok || !res.body) {
        setError(t.diet.calcError);
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setResult(cleanDietOutput(acc));
      }
      const normalized = cleanDietOutput(acc);
      setResult(normalized);
      console.log("[diet] streamed chars", normalized.length);
    } catch (err) {
      console.log("[diet] api error", err);
      setError(t.diet.calcError);
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2D5A27]/25";

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PremiumModal open={premiumOpen} onClose={() => setPremiumOpen(false)} />

      {modeOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-xl sm:p-6">
            <h2 className="text-lg font-bold text-[#2D5A27] sm:text-xl">
              {t.diet.modeModalTitle}
            </h2>
            <p className="mt-1 text-sm text-neutral-600">{t.diet.modeModalDesc}</p>

            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={() => runMode("pantry")}
                className="group flex w-full flex-col gap-1 rounded-2xl border border-[#2D5A27]/15 bg-[#faf8f5] p-4 text-left transition hover:border-[#2D5A27]/45 hover:bg-white"
              >
                <span className="text-sm font-bold text-[#2D5A27]">
                  📦 {t.diet.modePantryTitle}
                </span>
                <span className="text-xs leading-relaxed text-neutral-600">
                  {t.diet.modePantryDesc}
                </span>
              </button>

              <button
                type="button"
                onClick={() => runMode("dietitian")}
                className="group flex w-full flex-col gap-1 rounded-2xl border border-[#F28C28]/30 bg-[#fff7ec] p-4 text-left transition hover:border-[#F28C28]/60 hover:bg-white"
              >
                <span className="text-sm font-bold text-[#d07113]">
                  🥗 {t.diet.modeDietitianTitle}
                </span>
                <span className="text-xs leading-relaxed text-neutral-700">
                  {t.diet.modeDietitianDesc}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setModeOpen(false)}
              className="mt-4 w-full rounded-full border border-neutral-200 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
            >
              {t.diet.modeCancel}
            </button>
          </div>
        </div>
      )}

      <header className="mb-6">
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ${
            isPremium || isOwner
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {isPremium || isOwner ? "Premium Aktif" : t.diet.premiumBadge}
        </span>
        <h1 className="mt-3 text-3xl font-bold text-[#2D5A27]">{t.diet.premiumTitle}</h1>
        <p className="mt-2 text-neutral-600">{t.diet.premiumDesc}</p>
      </header>

      <form
        onSubmit={validateAndOpenMode}
        className="space-y-4 rounded-2xl border border-[#2D5A27]/12 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-[#2D5A27]">{t.diet.height}</label>
            <input
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className={inputCls}
              placeholder="170"
              inputMode="decimal"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#2D5A27]">{t.diet.weight}</label>
            <input
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className={inputCls}
              placeholder="72"
              inputMode="decimal"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#2D5A27]">{t.diet.gender}</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as "female" | "male")}
              className={inputCls}
            >
              <option value="female">{t.diet.female}</option>
              <option value="male">{t.diet.male}</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#2D5A27]">{t.diet.age}</label>
            <input
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className={inputCls}
              placeholder="32"
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#2D5A27]">{t.diet.activity}</label>
            <select
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
              className={inputCls}
            >
              <option value="sedentary">{t.diet.sedentary}</option>
              <option value="light">{t.diet.light}</option>
              <option value="moderate">{t.diet.moderate}</option>
              <option value="active">{t.diet.active}</option>
              <option value="very_active">{t.diet.veryActive}</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#2D5A27]">{t.diet.goal}</label>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value as Goal)}
              className={inputCls}
            >
              <option value="kilo_verme">{t.diet.weightLoss}</option>
              <option value="kas">{t.diet.muscle}</option>
              <option value="koruma">{t.diet.maintain}</option>
            </select>
          </div>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-[#2D5A27] py-3 text-sm font-semibold text-white transition hover:bg-[#234822] disabled:opacity-50"
        >
          {loading ? t.diet.calcLoading : t.diet.calculate}
        </button>

        {!isPremium && !isOwner && (
          <button
            type="button"
            onClick={() => setPremiumOpen(true)}
            className="w-full rounded-full border border-[#F28C28]/40 bg-[#F28C28]/10 py-3 text-sm font-semibold text-[#d07113] transition hover:bg-[#F28C28]/15"
          >
            {t.diet.premiumBtn}
          </button>
        )}
      </form>

      {(loading || result) && (
        <section className="mt-6 rounded-2xl border border-[#2D5A27]/12 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#2D5A27]">{t.diet.resultTitle}</h2>
              {activeMode && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    activeMode === "pantry"
                      ? "bg-[#2D5A27]/10 text-[#2D5A27]"
                      : "bg-[#F28C28]/15 text-[#d07113]"
                  }`}
                >
                  {activeMode === "pantry" ? t.diet.pantryBadge : t.diet.dietitianBadge}
                </span>
              )}
            </div>
            {activeMode && !loading && (isPremium || isOwner) && (
              <button
                type="button"
                onClick={() => runMode(activeMode, true)}
                className="rounded-full border border-[#2D5A27]/30 px-3 py-1.5 text-xs font-semibold text-[#2D5A27] transition hover:bg-[#2D5A27]/5"
              >
                {t.diet.regenerate}
              </button>
            )}
          </div>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
            {loading && !result ? t.diet.calcLoading : result}
          </div>
        </section>
      )}
    </div>
  );
}
