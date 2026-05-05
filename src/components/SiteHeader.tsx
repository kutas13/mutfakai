"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isAdmin } from "@/lib/auth/admin";
import { useLang } from "@/lib/i18n/context";

const linkClass =
  "rounded-full px-3 py-2 text-sm font-medium text-[#2D5A27] transition hover:bg-[#2D5A27]/10 sm:px-4";

const primaryBtn =
  "rounded-full bg-[#F28C28] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e07d1f] sm:px-4";

const outlineBtn =
  "rounded-full border border-[#2D5A27]/25 bg-white px-3 py-2 text-sm font-semibold text-[#2D5A27] transition hover:border-[#2D5A27]/50 sm:px-4";

export function SiteHeader({
  email,
  displayName,
}: {
  email: string | null;
  displayName: string | null;
}) {
  const router = useRouter();
  const { t, lang, setLang } = useLang();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  }

  const admin = isAdmin(email);

  return (
    <header className="sticky top-0 z-40 border-b border-[#2D5A27]/10 bg-[#faf8f5]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-[#2D5A27]" aria-label="MutfakAI">
          <Image src="/logo.png" alt="" width={160} height={40} className="h-8 w-auto max-h-9 object-contain object-left sm:h-9 sm:max-h-10" priority />
        </Link>

        <nav className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
          <Link href="/pisir" className={primaryBtn}>{t.nav.cook}</Link>
          <Link href="/rastgele" className={linkClass}>{t.nav.random}</Link>
          <Link href="/mutfak" className={linkClass}>{t.nav.kitchen}</Link>
          <Link href="/hazir-yemekler" className={linkClass}>{t.nav.recipes}</Link>
          <Link href="/diyet" className={linkClass}>{t.nav.diet}</Link>

          {admin && (
            <Link href="/admin" className="rounded-full bg-red-600/90 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 sm:px-4">
              {t.nav.admin}
            </Link>
          )}

          <button
            type="button"
            onClick={() => setLang(lang === "tr" ? "en" : "tr")}
            className="rounded-full border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-bold text-neutral-700 transition hover:border-neutral-400"
            aria-label="Switch language"
          >
            {lang === "tr" ? "EN" : "TR"}
          </button>

          {email ? (
            <div className="flex items-center gap-2 pl-1">
              {displayName && (
                <span className="hidden max-w-[140px] truncate text-xs font-medium text-[#2D5A27] md:inline">
                  {displayName}
                </span>
              )}
              <button type="button" onClick={signOut} className={outlineBtn}>{t.nav.logout}</button>
            </div>
          ) : (
            <Link href="/auth" className={outlineBtn}>{t.nav.login}</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
