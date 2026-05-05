"use client";

import Link from "next/link";
import { useLang } from "@/lib/i18n/context";

const card =
  "flex h-full flex-col rounded-2xl border border-[#2D5A27]/12 bg-white p-6 shadow-sm transition hover:border-[#F28C28]/40 hover:shadow-md";

export default function HomePage() {
  const { t, lang } = useLang();

  const stats =
    lang === "tr"
      ? [
          { label: "Aktif tarif akışı", value: "Canlı AI" },
          { label: "Desteklenen birim", value: "8+" },
          { label: "Mobil uyum", value: "%100" },
          { label: "Dil desteği", value: "TR / EN" },
        ]
      : [
          { label: "Recipe workflow", value: "Live AI" },
          { label: "Supported units", value: "8+" },
          { label: "Mobile readiness", value: "100%" },
          { label: "Languages", value: "TR / EN" },
        ];

  const featureBlocks =
    lang === "tr"
      ? [
          {
            title: "Akıllı Dolap Yönetimi",
            desc: "Malzemelerini hızlıca ekle, kategori ve birim dönüşümü ile düzenli bir stok görünümü elde et.",
          },
          {
            title: "Ne Pişirsem? Sandbox",
            desc: "Seçtiğin malzemelere göre anında fikir kartları al; tek tıkla kişi sayısına göre tam tarife geç.",
          },
          {
            title: "Premium Diyet Asistanı",
            desc: "Boy, kilo, yaş, cinsiyet ve aktiviteye göre BMR/TDEE temelli günlük plan üret.",
          },
        ]
      : [
          {
            title: "Smart Pantry Management",
            desc: "Add ingredients quickly and keep stock structured with category and unit conversions.",
          },
          {
            title: "What Should I Cook? Sandbox",
            desc: "Get instant idea cards from selected ingredients, then jump to a serving-scaled full recipe.",
          },
          {
            title: "Premium Diet Assistant",
            desc: "Generate BMR/TDEE based daily plans from height, weight, age, gender and activity.",
          },
        ];

  const faqs =
    lang === "tr"
      ? [
          {
            q: "Tarifi yazdıktan sonra malzeme düşümü otomatik mi?",
            a: "Stok düşümü kullanıcı onayı ile 'Yemeği Pişir' adımında yapılır.",
          },
          {
            q: "Aynı hesabı telefonda ve bilgisayarda kullanabilir miyim?",
            a: "Evet, oturum açtığında aynı dolap verileri tüm cihazlarda görünür.",
          },
          {
            q: "Diyet planı neden Premium?",
            a: "Kişiye özel hesaplama ve AI maliyetleri nedeniyle bu özellik Premium akışında tutulur.",
          },
        ]
      : [
          {
            q: "Is stock deduction automatic after recipe generation?",
            a: "Deduction happens on user confirmation at the 'Cook It' step.",
          },
          {
            q: "Can I use the same account on mobile and desktop?",
            a: "Yes. Once logged in, your pantry data syncs across devices.",
          },
          {
            q: "Why is diet planning premium-only?",
            a: "Personalized calculations and AI costs are covered through the Premium flow.",
          },
        ];

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

      <section className="mx-auto max-w-6xl px-4 pb-6 sm:px-6">
        <div className="grid gap-3 rounded-3xl border border-[#2D5A27]/10 bg-white p-4 shadow-sm sm:grid-cols-4 sm:gap-4 sm:p-6">
          {stats.map((item) => (
            <div key={item.label} className="rounded-2xl bg-[#faf8f5] p-4 text-center">
              <p className="text-xl font-bold text-[#2D5A27]">{item.value}</p>
              <p className="mt-1 text-xs text-neutral-600">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {featureBlocks.map((f) => (
            <article key={f.title} className={card}>
              <h3 className="text-lg font-semibold text-[#2D5A27]">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        <div className="rounded-3xl border border-[#2D5A27]/10 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-bold text-[#2D5A27] sm:text-2xl">
            {lang === "tr" ? "Sık Sorulanlar" : "Frequently Asked Questions"}
          </h2>
          <div className="mt-5 space-y-3">
            {faqs.map((item) => (
              <div key={item.q} className="rounded-2xl border border-neutral-100 bg-[#faf8f5] p-4">
                <p className="text-sm font-semibold text-[#2D5A27]">{item.q}</p>
                <p className="mt-1 text-sm text-neutral-600">{item.a}</p>
              </div>
            ))}
          </div>
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

      <footer className="border-t border-[#2D5A27]/10 py-5 text-center">
        <p className="text-xs font-medium tracking-wide text-neutral-500">prod by YUSUF KUTAS</p>
      </footer>
    </div>
  );
}
