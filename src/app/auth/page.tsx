"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n/context";

function mapAuthError(message: string, isEn: boolean): string {
  const m = message.toLowerCase();
  if (m.includes("email rate limit exceeded") || m.includes("rate limit")) {
    return isEn
      ? "Too many signup attempts in a short time. Please wait 60 seconds and try again, or log in if account already exists."
      : "Kısa sürede çok fazla kayıt denendi. 60 saniye bekleyip tekrar dene veya hesap oluştuysa giriş yap.";
  }
  if (m.includes("email not confirmed")) {
    return isEn
      ? "Email confirmation is enabled in Supabase. Disable it from Auth > Providers > Email to allow instant signup."
      : "Supabase'te e-posta doğrulaması açık. Anında kayıt için Auth > Providers > Email bölümünden kapat.";
  }
  return message;
}

function AuthFormInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { t, lang } = useLang();
  const nextRaw = params.get("next") || "/mutfak";
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/mutfak";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(m: "login" | "register") {
    setMode(m);
    setError(null);
    setSuccessInfo(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessInfo(null);
    setLoading(true);
    const supabase = createClient();

    try {
      if (mode === "register") {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { first_name: firstName.trim(), last_name: lastName.trim() },
          },
        });
        if (err) {
          setError(mapAuthError(err.message, lang === "en"));
          return;
        }
        if (data.session) {
          router.push(next);
          router.refresh();
          return;
        }
        if (data.user) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (!signInErr) {
            router.push(next);
            router.refresh();
            return;
          }

          // If Supabase email confirmation is enabled in dashboard, instant login is blocked.
          // We still show account created message so user sees a successful signup.
          setSuccessInfo(t.auth.accountCreated);
          setMode("login");
          return;
        }
        setError(t.auth.registrationFailed);
        return;
      }

      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) {
        setError(mapAuthError(err.message, lang === "en"));
        return;
      }
      router.push(next);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none ring-[#2D5A27]/20 focus:ring-2";

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-3xl border border-[#2D5A27]/15 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-[#2D5A27]">{t.auth.title}</h1>
        <p className="mt-1 text-sm text-neutral-600">{t.auth.subtitle}</p>

        <div className="mt-6 flex rounded-full bg-neutral-100 p-1">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
                mode === m ? "bg-white text-[#2D5A27] shadow-sm" : "text-neutral-600"
              }`}
              onClick={() => switchMode(m)}
            >
              {m === "login" ? t.auth.login : t.auth.register}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {mode === "register" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="fname" className="block text-sm font-medium text-[#2D5A27]">
                  {t.auth.firstName}
                </label>
                <input
                  id="fname"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="lname" className="block text-sm font-medium text-[#2D5A27]">
                  {t.auth.lastName}
                </label>
                <input
                  id="lname"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#2D5A27]">
              {t.auth.email}
            </label>
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#2D5A27]">
              {t.auth.password}
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
            {mode === "register" && (
              <p className="mt-1 text-xs text-neutral-500">{t.auth.passwordHint}</p>
            )}
          </div>
          {successInfo && (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">{successInfo}</p>
          )}
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[#F28C28] py-3 text-sm font-semibold text-white transition hover:bg-[#e07d1f] disabled:opacity-50"
          >
            {loading ? t.auth.loading : mode === "login" ? t.auth.loginBtn : t.auth.registerBtn}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-600">
          <Link href="/" className="font-medium text-[#2D5A27] hover:underline">{t.auth.backHome}</Link>
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="p-16 text-center text-sm text-neutral-600">Yükleniyor…</div>}>
      <AuthFormInner />
    </Suspense>
  );
}
