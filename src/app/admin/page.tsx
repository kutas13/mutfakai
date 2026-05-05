"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isAdmin } from "@/lib/auth/admin";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/i18n/context";

type PremiumReq = {
  id: string;
  user_id: string;
  phone_number: string;
  status: string;
  created_at: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  is_premium?: boolean;
};

type RegisteredUser = {
  id: string;
  first_name: string;
  last_name: string;
  is_premium: boolean;
  lang: "tr" | "en";
  created_at: string;
};

type AuditLog = {
  id: string;
  user_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
  first_name?: string;
  last_name?: string;
};

type FortuneRow = {
  id: string;
  user_id: string;
  full_name: string;
  dob: string | null;
  relationship: "yes" | "no";
  partner_name: string | null;
  photo_count: number;
  fortune_text: string;
  lang: string;
  created_at: string;
};

export default function AdminPage() {
  const router = useRouter();
  const { t } = useLang();
  const [rows, setRows] = useState<PremiumReq[]>([]);
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [fortunes, setFortunes] = useState<FortuneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user || !isAdmin(user.email)) {
      router.replace("/");
      return;
    }
    setAuthed(true);

    const { data: reqs } = await sb
      .from("premium_requests")
      .select("id, user_id, phone_number, status, created_at")
      .order("created_at", { ascending: false });

    const { data: profiles } = await sb.from("profiles").select("id, first_name, last_name, is_premium");
    const { data: allUsers } = await sb
      .from("profiles")
      .select("id, first_name, last_name, is_premium, lang, created_at")
      .order("created_at", { ascending: false });

    const merged: PremiumReq[] = (reqs ?? []).map((r) => {
      const p = (profiles ?? []).find((p) => p.id === r.user_id);
      return {
        ...r,
        first_name: p?.first_name ?? "",
        last_name: p?.last_name ?? "",
        is_premium: p?.is_premium ?? false,
      };
    });
    setRows(merged);
    setUsers((allUsers ?? []) as RegisteredUser[]);

    const { data: audit } = await sb
      .from("admin_audit_logs")
      .select("id, user_id, event_type, payload, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    const joinedLogs: AuditLog[] = (audit ?? []).map((log) => {
      const p = (profiles ?? []).find((pr) => pr.id === log.user_id);
      return {
        id: log.id,
        user_id: log.user_id,
        event_type: log.event_type,
        payload: (log.payload ?? {}) as Record<string, unknown>,
        created_at: log.created_at,
        first_name: p?.first_name ?? "",
        last_name: p?.last_name ?? "",
      };
    });
    setLogs(joinedLogs);

    const { data: fortuneRows } = await sb
      .from("fortune_readings")
      .select(
        "id, user_id, full_name, dob, relationship, partner_name, photo_count, fortune_text, lang, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    setFortunes((fortuneRows ?? []) as FortuneRow[]);

    setLoading(false);
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function togglePremium(userId: string, current: boolean) {
    const sb = createClient();
    await sb.from("profiles").update({ is_premium: !current }).eq("id", userId);
    await load();
  }

  if (!authed) return <div className="p-16 text-center text-sm text-neutral-600">Yükleniyor…</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#2D5A27]">{t.admin.title}</h1>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-[#2D5A27]">{t.admin.premiumRequests}</h2>

        {loading ? (
          <p className="mt-4 text-sm text-neutral-500">Yükleniyor…</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">{t.admin.noRequests}</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-[#2D5A27]/12 bg-white shadow-sm">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="border-b border-neutral-100 bg-[#faf8f5] text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">{t.admin.name}</th>
                  <th className="px-4 py-3 font-medium">{t.admin.phone}</th>
                  <th className="px-4 py-3 font-medium">{t.admin.date}</th>
                  <th className="px-4 py-3 font-medium">{t.admin.status}</th>
                  <th className="px-4 py-3 font-medium">{t.admin.activatePremium}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {r.first_name} {r.last_name}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-neutral-700">{r.phone_number}</td>
                    <td className="px-4 py-3 text-neutral-600">
                      {new Date(r.created_at).toLocaleDateString("tr-TR")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        r.is_premium ? "bg-emerald-100 text-emerald-800" : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {r.is_premium ? "Aktif" : r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => togglePremium(r.user_id, !!r.is_premium)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          r.is_premium ? "bg-[#2D5A27]" : "bg-neutral-300"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            r.is_premium ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[#2D5A27]">Kayıtlı Kullanıcılar</h2>
        {users.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">Henüz kullanıcı kaydı yok.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-[#2D5A27]/12 bg-white shadow-sm">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-neutral-100 bg-[#faf8f5] text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Ad Soyad</th>
                  <th className="px-4 py-3 font-medium">Dil</th>
                  <th className="px-4 py-3 font-medium">Premium</th>
                  <th className="px-4 py-3 font-medium">Kayıt Tarihi</th>
                  <th className="px-4 py-3 font-medium">Kullanıcı ID</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-4 py-3 uppercase text-neutral-600">{u.lang}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          u.is_premium
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-neutral-100 text-neutral-700"
                        }`}
                      >
                        {u.is_premium ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {new Date(u.created_at).toLocaleString("tr-TR")}
                    </td>
                    <td className="max-w-[260px] truncate px-4 py-3 font-mono text-xs text-neutral-600">
                      {u.id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[#2D5A27]">Kahve Falı Yedekleri</h2>
        {(() => {
          if (fortunes.length === 0) {
            return (
              <p className="mt-4 text-sm text-neutral-500">
                Henüz bakılan fal yok.
              </p>
            );
          }
          const grouped = new Map<string, FortuneRow[]>();
          for (const f of fortunes) {
            const name = (f.full_name ?? "").trim() || "—";
            const arr = grouped.get(name) ?? [];
            arr.push(f);
            grouped.set(name, arr);
          }
          const groups = [...grouped.entries()].sort((a, b) =>
            a[0].localeCompare(b[0], "tr"),
          );
          return (
            <div className="mt-4 space-y-4">
              {groups.map(([name, items]) => (
                <details
                  key={name}
                  className="overflow-hidden rounded-2xl border border-[#2D5A27]/12 bg-white shadow-sm"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-[#2D5A27]">
                    <span>{name}</span>
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700">
                      {items.length} fal
                    </span>
                  </summary>
                  <div className="space-y-3 border-t border-neutral-100 bg-[#faf8f5] p-4">
                    {items.map((f) => (
                      <article
                        key={f.id}
                        className="rounded-xl border border-purple-200 bg-white p-3"
                      >
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600">
                          <span className="font-semibold text-[#2D5A27]">
                            {new Date(f.created_at).toLocaleString("tr-TR")}
                          </span>
                          <span>D.T: {f.dob ?? "—"}</span>
                          <span>
                            İlişki:{" "}
                            {f.relationship === "yes"
                              ? `Var${f.partner_name ? ` (${f.partner_name})` : ""}`
                              : "Yok"}
                          </span>
                          <span>{f.photo_count} foto</span>
                          <span className="uppercase">{f.lang}</span>
                        </div>
                        <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-neutral-800">
                          {f.fortune_text}
                        </pre>
                      </article>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          );
        })()}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[#2D5A27]">Giriş / Çıkış Geçmişi</h2>
        {(() => {
          const authLogs = logs.filter(
            (l) => l.event_type === "user_login" || l.event_type === "user_logout",
          );
          if (authLogs.length === 0) {
            return (
              <p className="mt-4 text-sm text-neutral-500">
                Henüz giriş/çıkış kaydı yok.
              </p>
            );
          }
          return (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-[#2D5A27]/12 bg-white shadow-sm">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-neutral-100 bg-[#faf8f5] text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Kullanıcı</th>
                    <th className="px-4 py-3 font-medium">E-posta</th>
                    <th className="px-4 py-3 font-medium">Olay</th>
                    <th className="px-4 py-3 font-medium">Tarih</th>
                    <th className="px-4 py-3 font-medium">Cihaz</th>
                  </tr>
                </thead>
                <tbody>
                  {authLogs.map((log) => {
                    const isLogin = log.event_type === "user_login";
                    const email = (log.payload?.email as string | undefined) ?? "—";
                    const ua = (log.payload?.userAgent as string | undefined) ?? "";
                    return (
                      <tr key={log.id} className="border-b border-neutral-50 align-top">
                        <td className="px-4 py-3 font-medium text-neutral-900">
                          {[log.first_name, log.last_name].filter(Boolean).join(" ") || "—"}
                        </td>
                        <td className="px-4 py-3 text-neutral-700">{email}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              isLogin
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {isLogin ? "Giriş" : "Çıkış"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-neutral-600">
                          {new Date(log.created_at).toLocaleString("tr-TR")}
                        </td>
                        <td className="max-w-[260px] truncate px-4 py-3 text-xs text-neutral-500">
                          {ua}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[#2D5A27]">Akış Test Logları</h2>
        {logs.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">Henüz log kaydı yok.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-[#2D5A27]/12 bg-white shadow-sm">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-neutral-100 bg-[#faf8f5] text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Kullanıcı</th>
                  <th className="px-4 py-3 font-medium">Event</th>
                  <th className="px-4 py-3 font-medium">Payload</th>
                  <th className="px-4 py-3 font-medium">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-neutral-50 align-top">
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {log.first_name} {log.last_name}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-[#2D5A27]/10 px-2 py-0.5 text-xs font-semibold text-[#2D5A27]">
                        {log.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-700">
                      {JSON.stringify(log.payload)}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {new Date(log.created_at).toLocaleString("tr-TR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
