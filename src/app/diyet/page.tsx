"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n/context";
import { PremiumModal } from "@/components/PremiumModal";

export default function DiyetPage() {
  const { t } = useLang();
  const [isPremium, setIsPremium] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [gender, setGender] = useState("kadın");
  const [age, setAge] = useState("");
  const [goal, setGoal] = useState("kilo_verme");

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { data } = await sb.from("profiles").select("is_premium").eq("id", user.id).single();
      if (data?.is_premium) setIsPremium(true);
    })();
  }, []);

  function onCalculate(e: React.FormEvent) {
    e.preventDefault();
    if (!isPremium) {
      setModalOpen(true);
      return;
    }
    alert(t.diet.unlocked);
  }

  const inputCls = "mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2D5A27]/25";

  if (isPremium) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-800">
          Premium Aktif
        </span>
        <h1 className="mt-3 text-3xl font-bold text-[#2D5A27]">{t.diet.premiumTitle}</h1>
        <p className="mt-2 text-neutral-600">{t.diet.premiumDesc}</p>

        <form onSubmit={onCalculate} className="mt-8 space-y-4 rounded-2xl border border-[#2D5A27]/12 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="text-xs font-semibold text-[#2D5A27]">{t.diet.height}</label><input value={height} onChange={(e) => setHeight(e.target.value)} className={inputCls} placeholder="170" /></div>
            <div><label className="text-xs font-semibold text-[#2D5A27]">{t.diet.weight}</label><input value={weight} onChange={(e) => setWeight(e.target.value)} className={inputCls} placeholder="72" /></div>
            <div><label className="text-xs font-semibold text-[#2D5A27]">{t.diet.gender}</label><select value={gender} onChange={(e) => setGender(e.target.value)} className={inputCls}><option value="kadın">{t.diet.female}</option><option value="erkek">{t.diet.male}</option></select></div>
            <div><label className="text-xs font-semibold text-[#2D5A27]">{t.diet.age}</label><input value={age} onChange={(e) => setAge(e.target.value)} className={inputCls} placeholder="32" /></div>
            <div className="sm:col-span-2"><label className="text-xs font-semibold text-[#2D5A27]">{t.diet.goal}</label><select value={goal} onChange={(e) => setGoal(e.target.value)} className={inputCls}><option value="kilo_verme">{t.diet.weightLoss}</option><option value="kas">{t.diet.muscle}</option><option value="koruma">{t.diet.maintain}</option></select></div>
          </div>
          <button type="submit" className="w-full rounded-full bg-[#2D5A27] py-3 text-sm font-semibold text-white transition hover:bg-[#234822]">{t.diet.calculate}</button>
        </form>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PremiumModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <div className="relative min-h-[640px] overflow-hidden rounded-3xl border border-[#2D5A27]/10 bg-[#faf8f5]">
        <div className="pointer-events-none select-none px-6 py-10 blur-sm sm:px-10">
          <h1 className="text-3xl font-bold text-[#2D5A27]">{t.diet.premiumTitle}</h1>
          <p className="mt-2 text-neutral-600">{t.diet.premiumDesc}</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-white shadow-inner" />
            ))}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 bg-[#faf8f5]/70 backdrop-blur-[2px]" />

        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#2D5A27]/15 bg-white p-8 shadow-2xl">
            <p className="text-center text-xs font-bold uppercase tracking-widest text-[#F28C28]">{t.diet.premiumBadge}</p>
            <h2 className="mt-2 text-center text-2xl font-bold text-[#2D5A27]">{t.diet.premiumTitle}</h2>
            <p className="mt-3 text-center text-sm leading-relaxed text-neutral-600">{t.diet.premiumDesc}</p>
            <button
              type="button"
              className="mt-6 w-full rounded-full bg-[#F28C28] py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#e07d1f]"
              onClick={() => setModalOpen(true)}
            >
              {t.diet.premiumBtn}
            </button>

            <form onSubmit={onCalculate} className="mt-8 space-y-4">
              <p className="text-center text-xs font-semibold text-[#2D5A27]">{t.diet.preview}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="text-xs font-semibold text-[#2D5A27]">{t.diet.height}</label><input value={height} onChange={(e) => setHeight(e.target.value)} className={inputCls} placeholder="170" /></div>
                <div><label className="text-xs font-semibold text-[#2D5A27]">{t.diet.weight}</label><input value={weight} onChange={(e) => setWeight(e.target.value)} className={inputCls} placeholder="72" /></div>
                <div><label className="text-xs font-semibold text-[#2D5A27]">{t.diet.gender}</label><select value={gender} onChange={(e) => setGender(e.target.value)} className={inputCls}><option value="kadın">{t.diet.female}</option><option value="erkek">{t.diet.male}</option></select></div>
                <div><label className="text-xs font-semibold text-[#2D5A27]">{t.diet.age}</label><input value={age} onChange={(e) => setAge(e.target.value)} className={inputCls} placeholder="32" /></div>
              </div>
              <button type="submit" className="w-full rounded-full border-2 border-[#2D5A27] py-3 text-sm font-semibold text-[#2D5A27] transition hover:bg-[#2D5A27]/5">{t.diet.calculate}</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
