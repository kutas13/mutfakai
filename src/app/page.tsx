"use client";

import Link from "next/link";
import { useLang } from "@/lib/i18n/context";

const card =
  "flex h-full flex-col rounded-2xl border border-[#2D5A27]/12 bg-white p-6 shadow-sm transition hover:border-[#F28C28]/40 hover:shadow-md";

export default function HomePage() {
  const { t, lang } = useLang();
  const isTr = lang === "tr";

  const stats = isTr
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

  const featureBlocks = isTr
    ? [
        {
          icon: "📦",
          title: "Akıllı Dolap Yönetimi",
          desc: "Malzemelerini hızlıca ekle, kategori ve birim dönüşümü ile düzenli bir stok görünümü elde et.",
        },
        {
          icon: "🎲",
          title: "Ne Pişirsem? Sandbox",
          desc: "Seçtiğin malzemelere göre anında fikir kartları al; tek tıkla kişi sayısına göre tam tarife geç.",
        },
        {
          icon: "🥗",
          title: "Premium Diyet Asistanı",
          desc: "Boy, kilo, yaş, cinsiyet ve aktiviteye göre BMR/TDEE temelli günlük plan üret.",
        },
      ]
    : [
        {
          icon: "📦",
          title: "Smart Pantry Management",
          desc: "Add ingredients quickly and keep stock structured with category and unit conversions.",
        },
        {
          icon: "🎲",
          title: "What Should I Cook? Sandbox",
          desc: "Get instant idea cards from selected ingredients, then jump to a serving-scaled full recipe.",
        },
        {
          icon: "🥗",
          title: "Premium Diet Assistant",
          desc: "Generate BMR/TDEE based daily plans from height, weight, age, gender and activity.",
        },
      ];

  const benefits = isTr
    ? [
        { icon: "⚡", title: "Hızlı Karar", desc: "Açıklamayı yaz, AI saniyeler içinde tarif önerisi sunsun." },
        { icon: "🌱", title: "Sıfır İsraf", desc: "Dolaptaki malzemeleri tüketerek atıkları minimuma indir." },
        { icon: "📱", title: "Mobil Öncelikli", desc: "Telefonunda da masaüstünde de aynı akıcı deneyim." },
        { icon: "🔒", title: "Güvenli Veri", desc: "Hesabın Supabase ile korunur, dolabın yalnızca sana ait." },
        { icon: "🧠", title: "Profesyonel Şef", desc: "AI gerçek bir mutfak şefi gibi mise en place ve tekniklerle yönlendirir." },
        { icon: "📊", title: "Takip Et", desc: "Her tarifin stoğunu otomatik düşür, ne kadar kaldı bir bakışta gör." },
      ]
    : [
        { icon: "⚡", title: "Fast Decisions", desc: "Type a prompt, the AI suggests a recipe in seconds." },
        { icon: "🌱", title: "Zero Waste", desc: "Cook with what you have and minimize food waste." },
        { icon: "📱", title: "Mobile First", desc: "The same fluid experience on phone or desktop." },
        { icon: "🔒", title: "Secure Data", desc: "Your account is protected by Supabase auth, your pantry is yours alone." },
        { icon: "🧠", title: "Pro Chef", desc: "The AI guides you with mise en place and proper culinary techniques." },
        { icon: "📊", title: "Track Stock", desc: "Stock is auto-deducted per recipe, see what's left at a glance." },
      ];

  const steps = isTr
    ? [
        {
          step: "01",
          title: "Dolabını Doldur",
          desc: "Dolabım sayfasında malzemeleri kategori bazlı ekle. Birim dönüşümü ve gram bazlı saklama otomatik.",
          link: "/mutfak",
          linkLabel: "Dolabım",
        },
        {
          step: "02",
          title: "Şef ile Konuş",
          desc: "Pişir sayfasında AI Şef ile sohbet et. Kişi sayısını seç, çıkarmak istediğin malzemeleri tıkla.",
          link: "/pisir",
          linkLabel: "Pişir",
        },
        {
          step: "03",
          title: "Tek Tıkla Pişir",
          desc: "Tarif geldiğinde 'Yemeği Pişir' de — kullanılan miktarlar dolabından otomatik düşülür.",
          link: "/hazir-yemekler",
          linkLabel: "Hazır Tarifler",
        },
      ]
    : [
        {
          step: "01",
          title: "Stock Your Pantry",
          desc: "Add ingredients on the Pantry page by category. Unit conversion and gram-based storage are automatic.",
          link: "/mutfak",
          linkLabel: "Pantry",
        },
        {
          step: "02",
          title: "Chat with the Chef",
          desc: "Talk to the AI chef on the Cook page. Set servings, click ingredients you'd like to skip.",
          link: "/pisir",
          linkLabel: "Cook",
        },
        {
          step: "03",
          title: "Cook in One Tap",
          desc: "When the recipe is ready, hit 'Cook It' — used quantities are deducted from your pantry.",
          link: "/hazir-yemekler",
          linkLabel: "Catalog",
        },
      ];

  const testimonials = isTr
    ? [
        { name: "Ayşe", role: "Ev Şefi", text: "Akşam ne pişireceğime karar veremiyordum, artık dolabımı açıp tek tıkla AI'a soruyorum. İsraf bitti." },
        { name: "Mert", role: "Yazılımcı", text: "Mobil arayüz çok hızlı, telefonumdan dolaba malzeme eklemek 10 saniyeyi geçmiyor." },
        { name: "Selin", role: "Diyetisyen Stajyeri", text: "Diyet planı sürekli yenilenmediği için takibim kolay, sevdim." },
      ]
    : [
        { name: "Ayse", role: "Home Cook", text: "I used to be stuck on what to cook. Now I open my pantry and ask the AI in a tap. Waste is gone." },
        { name: "Mert", role: "Software Engineer", text: "Mobile UX is so fast — adding to pantry from my phone takes under 10 seconds." },
        { name: "Selin", role: "Dietitian Intern", text: "The diet plan stays consistent rather than regenerating, that's perfect for tracking." },
      ];

  const popularRecipes = isTr
    ? [
        { emoji: "🍝", name: "Kremalı Tavuklu Makarna", time: "25 dk" },
        { emoji: "🥘", name: "Kıymalı Patates", time: "35 dk" },
        { emoji: "🍲", name: "Mercimek Çorbası", time: "30 dk" },
        { emoji: "🥗", name: "Akdeniz Salatası", time: "10 dk" },
        { emoji: "🍕", name: "Ev Yapımı Pizza", time: "45 dk" },
        { emoji: "🍳", name: "Menemen", time: "15 dk" },
      ]
    : [
        { emoji: "🍝", name: "Creamy Chicken Pasta", time: "25 min" },
        { emoji: "🥘", name: "Minced Meat with Potato", time: "35 min" },
        { emoji: "🍲", name: "Lentil Soup", time: "30 min" },
        { emoji: "🥗", name: "Mediterranean Salad", time: "10 min" },
        { emoji: "🍕", name: "Homemade Pizza", time: "45 min" },
        { emoji: "🍳", name: "Menemen", time: "15 min" },
      ];

  const faqs = isTr
    ? [
        { q: "Tarifi yazdıktan sonra malzeme düşümü otomatik mi?", a: "Stok düşümü kullanıcı onayı ile 'Yemeği Pişir' adımında yapılır." },
        { q: "Aynı hesabı telefonda ve bilgisayarda kullanabilir miyim?", a: "Evet, oturum açtığında aynı dolap verileri tüm cihazlarda görünür." },
        { q: "Diyet planı neden Premium?", a: "Kişiye özel hesaplama ve AI maliyetleri nedeniyle bu özellik Premium akışında tutulur." },
        { q: "Hesap oluşturmak için e-posta onayı gerekiyor mu?", a: "Hayır, kayıt ol dediğin anda hesabın oluşur ve otomatik giriş yaparsın." },
        { q: "Malzeme birimleri nasıl saklanıyor?", a: "Hepsi gram veya mililitre olarak saklanır; istediğin pratik birimi girersin (su bardağı, yemek kaşığı vb.) — gerisi otomatik dönüşür." },
      ]
    : [
        { q: "Is stock deduction automatic after recipe generation?", a: "Deduction happens on user confirmation at the 'Cook It' step." },
        { q: "Can I use the same account on mobile and desktop?", a: "Yes. Once logged in, your pantry data syncs across devices." },
        { q: "Why is diet planning premium-only?", a: "Personalized calculations and AI costs are covered through the Premium flow." },
        { q: "Do I need to confirm my email to register?", a: "No, your account is created instantly and you are signed in automatically." },
        { q: "How are ingredient units stored?", a: "Everything is stored in grams or millilitres; you type any practical unit (cup, tablespoon, etc.) — conversion is automatic." },
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
            <div className="mt-8 flex flex-wrap items-center gap-4 text-xs text-white/80">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                {isTr ? "Anlık AI yanıt" : "Live AI responses"}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-300" />
                {isTr ? "Birim dönüşümü dahil" : "Unit conversion included"}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-white" />
                {isTr ? "TR / EN" : "TR / EN"}
              </span>
            </div>
          </div>
          <div className="relative rounded-3xl border border-white/20 bg-white/10 p-6 backdrop-blur-md lg:p-8">
            <div className="space-y-4 text-sm">
              <div className="rounded-2xl bg-white p-4 text-[#2D5A27] shadow-lg">
                <p className="text-xs font-semibold uppercase text-[#F28C28]">
                  {isTr ? "Dolabında" : "In your pantry"}
                </p>
                <ul className="mt-2 space-y-1.5 font-medium">
                  <li className="flex justify-between"><span>🍗 {isTr ? "Tavuk" : "Chicken"}</span><span className="tabular-nums text-neutral-600">1000 gr</span></li>
                  <li className="flex justify-between"><span>🥚 {isTr ? "Yumurta" : "Eggs"}</span><span className="tabular-nums text-neutral-600">{isTr ? "10 adet" : "10 pcs"}</span></li>
                  <li className="flex justify-between"><span>🧅 {isTr ? "Soğan" : "Onion"}</span><span className="tabular-nums text-neutral-600">3 {isTr ? "adet" : "pcs"}</span></li>
                  <li className="flex justify-between"><span>🍅 {isTr ? "Domates" : "Tomato"}</span><span className="tabular-nums text-neutral-600">500 gr</span></li>
                </ul>
              </div>
              <div className="rounded-2xl bg-[#F28C28] p-4 text-white shadow-lg">
                <p className="text-xs font-semibold uppercase opacity-90">{isTr ? "Şef'in önerisi" : "Chef suggests"}</p>
                <p className="mt-1 font-semibold">{isTr ? "Tavuk Sote (4 kişilik)" : "Chicken Sauté (4 servings)"}</p>
                <p className="mt-1 text-xs opacity-90">{isTr ? "200 gr tavuk · 1 soğan · 2 domates kullanılacak" : "200 g chicken · 1 onion · 2 tomatoes will be used"}</p>
              </div>
              <p className="text-center text-xs text-white/80">
                {isTr ? "Pişirildiğinde stok otomatik güncellenir." : "Stock updates automatically when cooked."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-3 rounded-3xl border border-[#2D5A27]/10 bg-white p-4 shadow-sm sm:grid-cols-4 sm:gap-4 sm:p-6">
          {stats.map((item) => (
            <div key={item.label} className="rounded-2xl bg-[#faf8f5] p-4 text-center">
              <p className="text-xl font-bold text-[#2D5A27]">{item.value}</p>
              <p className="mt-1 text-xs text-neutral-600">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#F28C28]">
            {isTr ? "Neden MutfakAI?" : "Why MutfakAI?"}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[#2D5A27] sm:text-3xl">
            {isTr ? "Mutfağında dijital bir asistan" : "A digital assistant in your kitchen"}
          </h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b) => (
            <article key={b.title} className={card}>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#2D5A27]/8 text-2xl">
                {b.icon}
              </div>
              <h3 className="text-lg font-semibold text-[#2D5A27]">{b.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-600">{b.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#F28C28]">
            {isTr ? "Nasıl Çalışır?" : "How it works"}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[#2D5A27] sm:text-3xl">
            {isTr ? "3 adımda mutfakta düzen" : "Get organized in 3 steps"}
          </h2>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <article key={s.step} className="relative flex flex-col rounded-2xl border border-[#2D5A27]/12 bg-white p-6 shadow-sm">
              <span className="absolute -top-4 left-6 rounded-full bg-[#2D5A27] px-3 py-1 text-xs font-bold text-white">
                {s.step}
              </span>
              <h3 className="mt-3 text-lg font-semibold text-[#2D5A27]">{s.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-600">{s.desc}</p>
              <Link href={s.link} className="mt-4 inline-flex w-fit text-sm font-semibold text-[#F28C28] hover:underline">
                {s.linkLabel} &rarr;
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {featureBlocks.map((f) => (
            <article key={f.title} className={card}>
              <div className="mb-3 text-3xl">{f.icon}</div>
              <h3 className="text-lg font-semibold text-[#2D5A27]">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#faf8f5]">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#F28C28]">
              {isTr ? "Popüler tarifler" : "Popular recipes"}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[#2D5A27] sm:text-3xl">
              {isTr ? "Klasiklerle başla" : "Start with the classics"}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-neutral-600">
              {isTr
                ? "Hazır yemekler kataloğundan ilham al, dolabındaki malzemelerle anında pişir."
                : "Get inspired by the catalog and cook instantly with what you have."}
            </p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {popularRecipes.map((r) => (
              <article key={r.name} className="flex items-center gap-4 rounded-2xl border border-[#2D5A27]/10 bg-white p-4 shadow-sm">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F28C28]/15 text-2xl">
                  {r.emoji}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#2D5A27]">{r.name}</p>
                  <p className="text-xs text-neutral-500">{r.time}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/hazir-yemekler" className="inline-flex rounded-full border border-[#2D5A27]/30 px-6 py-3 text-sm font-semibold text-[#2D5A27] transition hover:border-[#2D5A27]/60">
              {isTr ? "Tüm hazır yemekler" : "Browse the catalog"} &rarr;
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#F28C28]">
            {isTr ? "Kullanıcılar ne diyor?" : "What users say"}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[#2D5A27] sm:text-3xl">
            {isTr ? "MutfakAI'la mutfakta zaman kazan" : "Save time in the kitchen with MutfakAI"}
          </h2>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {testimonials.map((tt) => (
            <article key={tt.name} className="flex flex-col rounded-2xl border border-[#2D5A27]/10 bg-white p-6 shadow-sm">
              <div className="text-2xl text-[#F28C28]">&ldquo;</div>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-700">{tt.text}</p>
              <div className="mt-5 flex items-center gap-3 border-t border-[#2D5A27]/10 pt-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2D5A27] text-sm font-bold text-white">
                  {tt.name.slice(0, 1)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#2D5A27]">{tt.name}</p>
                  <p className="text-xs text-neutral-500">{tt.role}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        <div className="rounded-3xl border border-[#2D5A27]/10 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-bold text-[#2D5A27] sm:text-2xl">
            {isTr ? "Sık Sorulanlar" : "Frequently Asked Questions"}
          </h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {faqs.map((item) => (
              <div key={item.q} className="rounded-2xl border border-neutral-100 bg-[#faf8f5] p-4">
                <p className="text-sm font-semibold text-[#2D5A27]">{item.q}</p>
                <p className="mt-1 text-sm text-neutral-600">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#2D5A27]/10 bg-gradient-to-br from-[#2D5A27]/5 via-white to-[#F28C28]/5 py-14">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#F28C28]">
            {isTr ? "Hemen dene" : "Get started"}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[#2D5A27] sm:text-3xl">{t.home.ctaSection}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-neutral-600">
            {isTr
              ? "Ücretsiz hesap oluştur, dolabını doldur ve AI Şef ile ilk tarifini pişir."
              : "Create a free account, stock your pantry and cook your first recipe with the AI chef."}
          </p>
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

      <footer className="border-t border-[#2D5A27]/10 py-6 text-center">
        <p className="text-xs font-medium tracking-wide text-neutral-500">prod by YUSUF KUTAS</p>
      </footer>
    </div>
  );
}
