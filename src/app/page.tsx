"use client";

import Link from "next/link";
import { useLang } from "@/lib/i18n/context";

const card =
  "flex h-full flex-col rounded-2xl border border-[#2D5A27]/12 bg-white p-6 shadow-sm transition hover:border-[#F28C28]/40 hover:shadow-md";

export default function HomePage() {
  const { t } = useLang();

  return (
    <div className="text-[#1c1917]">
      <section className="relative overflow-hidden bg-gradient-to-br from-[#2D5A27] via-[#3d7a36] to-[#2D5A27] px-4 pb-20 pt-14 text-white sm:px-6 sm:pt-20">
        <div className="pointer-events-none absolute -right-24 top-10 h-64 w-64 rounded-full bg-[#F28C28]/25 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white/90">
              {t.home.badge}
            </p>
            <h1 className="text-balance text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              {t.home.hero}
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-base text-white/85 sm:text-lg">
              {t.home.heroDesc}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/pisir" className="inline-flex items-center justify-center rounded-full bg-[#F28C28] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:bg-[#e07d1f]">
                {t.home.ctaCook}
              </Link>
              <Link href="/mutfak" className="inline-flex items-center justify-center rounded-full border border-white/35 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">
                {t.home.ctaKitchen}
              </Link>
            </div>
          </div>
          <div className="relative rounded-3xl border border-white/20 bg-white/10 p-6 backdrop-blur-md lg:p-8">
            <div className="space-y-4 text-sm">
              <div className="rounded-2xl bg-white p-4 text-[#2D5A27] shadow-lg">
                <p className="text-xs font-semibold uppercase text-[#F28C28]">
                  {t.home.badge}
                </p>
                <ul className="mt-2 space-y-1.5 font-medium">
                  <li className="flex justify-between"><span>Tavuk</span><span className="tabular-nums text-neutral-600">1000 gr</span></li>
                  <li className="flex justify-between"><span>Yumurta</span><span className="tabular-nums text-neutral-600">10 adet</span></li>
                </ul>
              </div>
              <p className="text-center text-xs text-white/80">
                Tarif pişirildiğinde stok otomatik güncellenir — örn. 200 gr tavuk kullanıldığında 800 gr kalır.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-[#2D5A27] sm:text-3xl">{t.home.sectionTitle}</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <article className={card}>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#2D5A27]/10 text-lg font-bold text-[#2D5A27]">1</div>
            <h3 className="text-lg font-semibold text-[#2D5A27]">{t.home.card1Title}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-600">{t.home.card1Desc}</p>
          </article>
          <article className={card}>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#F28C28]/15 text-lg font-bold text-[#F28C28]">2</div>
            <h3 className="text-lg font-semibold text-[#2D5A27]">{t.home.card2Title}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-600">{t.home.card2Desc}</p>
          </article>
          <article className={card}>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#2D5A27]/10 text-lg font-bold text-[#2D5A27]">3</div>
            <h3 className="text-lg font-semibold text-[#2D5A27]">{t.home.card3Title}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-600">{t.home.card3Desc}</p>
            <Link href="/diyet" className="mt-4 inline-flex text-sm font-semibold text-[#F28C28] hover:underline">
              Premium&apos;u incele &rarr;
            </Link>
          </article>
        </div>
      </section>

      <section className="border-t border-[#2D5A27]/10 bg-white/60 py-14">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#F28C28]">Hemen dene</p>
          <h2 className="mt-2 text-2xl font-bold text-[#2D5A27] sm:text-3xl">{t.home.ctaSection}</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/auth" className="rounded-full bg-[#2D5A27] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#234822]">
              {t.home.ctaSignup}
            </Link>
            <Link href="/hazir-yemekler" className="rounded-full border border-[#2D5A27]/30 px-6 py-3 text-sm font-semibold text-[#2D5A27] transition hover:border-[#2D5A27]/60">
              {t.home.ctaCatalog}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
