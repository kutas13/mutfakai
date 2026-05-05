"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n/context";
import { PremiumModal } from "@/components/PremiumModal";
import { isAdmin } from "@/lib/auth/admin";

type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
type Goal = "kilo_verme" | "kas" | "koruma" | "kalori_acigi";
type DietMode = "pantry" | "dietitian";
type FrequencyMode = "single" | "weekly" | "monthly";
type DietStyle = "standard" | "keto" | "omad";

type SinglePlan = { type: "single"; planText: string; exercise?: string };
type MultiPlan = {
  type: "multi";
  intro: string;
  budgetSummary: string;
  exercise: string;
  weeks: { label: string; days: { dayName: string; content: string }[] }[];
};
type PlanResponse = SinglePlan | MultiPlan;

export default function DiyetPage() {
  const { t, lang } = useLang();
  const [isPremium, setIsPremium] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [freqOpen, setFreqOpen] = useState(false);

  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [gender, setGender] = useState<"female" | "male">("female");
  const [age, setAge] = useState("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");
  const [goal, setGoal] = useState<Goal>("kilo_verme");
  const [dietStyle, setDietStyle] = useState<DietStyle>("standard");

  const [pendingMode, setPendingMode] = useState<DietMode | null>(null);
  const [freqChoice, setFreqChoice] = useState<"single" | "multi">("single");
  const [spanChoice, setSpanChoice] = useState<"weekly" | "monthly">("weekly");
  const [budget, setBudget] = useState("");
  const [targetKcal, setTargetKcal] = useState("");

  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [activeWeek, setActiveWeek] = useState(0);
  const [activeDay, setActiveDay] = useState(0);
  const [activeFrequency, setActiveFrequency] = useState<FrequencyMode | null>(null);
  const [activeMode, setActiveMode] = useState<DietMode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const tw = targetWeight.trim() ? Number(targetWeight.replace(",", ".")) : 0;

    const hasInvalid =
      Number.isNaN(h) ||
      Number.isNaN(w) ||
      Number.isNaN(a) ||
      Number.isNaN(tw) ||
      h <= 0 ||
      w <= 0 ||
      a <= 0 ||
      tw < 0 ||
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

  function pickMode(mode: DietMode) {
    setPendingMode(mode);
    setModeOpen(false);
    setFreqOpen(true);
  }

  async function runPlan(regenerate = false) {
    if (!pendingMode) return;
    const frequency: FrequencyMode = freqChoice === "single" ? "single" : spanChoice;
    setFreqOpen(false);
    setError(null);
    setPlan(null);
    setActiveMode(pendingMode);
    setActiveFrequency(frequency);
    setActiveWeek(0);
    setActiveDay(0);

    const h = Number(height.replace(",", "."));
    const w = Number(weight.replace(",", "."));
    const a = Number(age.replace(",", "."));
    const tw = targetWeight.trim() ? Number(targetWeight.replace(",", ".")) : 0;
    const budgetNum = Number(budget.replace(/[^\d]/g, ""));
    const kcalNum = Number(targetKcal.replace(/[^\d]/g, ""));

    setLoading(true);
    try {
      const res = await fetch("/api/diet-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          height: h,
          weight: w,
          age: a,
          targetWeight: Number.isFinite(tw) && tw > 0 ? tw : 0,
          gender,
          activityLevel,
          goal,
          lang,
          mode: pendingMode,
          frequency,
          dietStyle,
          budgetMonthlyTl: Number.isFinite(budgetNum) && budgetNum > 0 ? budgetNum : 0,
          targetKcal: Number.isFinite(kcalNum) && kcalNum > 0 ? kcalNum : 0,
          regenerate,
        }),
      });

      const ct = res.headers.get("content-type") ?? "";
      if (!res.ok) {
        if (ct.includes("application/json")) {
          const j = (await res.json()) as { error?: string };
          setError(j.error || t.diet.calcError);
        } else {
          setError(t.diet.calcError);
        }
        return;
      }

      if (ct.includes("application/x-ndjson")) {
        if (!res.body) {
          setError(t.diet.calcError);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const obj = JSON.parse(trimmed) as PlanResponse | { error?: string };
              if ("error" in obj && obj.error) {
                setError(obj.error || t.diet.calcError);
                continue;
              }
              setPlan(obj as PlanResponse);
            } catch {
              // ignore partial lines
            }
          }
        }
        const tail = buf.trim();
        if (tail) {
          try {
            const obj = JSON.parse(tail) as PlanResponse;
            setPlan(obj);
          } catch {
            // ignore
          }
        }
      } else {
        const data = (await res.json()) as PlanResponse;
        setPlan(data);
      }
    } catch (err) {
      console.log("[diet] api error", err);
      setError(t.diet.calcError);
    } finally {
      setLoading(false);
    }
  }

  function regenerateActive() {
    if (!activeMode || !activeFrequency) return;
    setPendingMode(activeMode);
    setFreqChoice(activeFrequency === "single" ? "single" : "multi");
    if (activeFrequency !== "single") {
      setSpanChoice(activeFrequency);
    }
    runPlan(true);
  }

  const inputCls =
    "mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2D5A27]/25";

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PremiumModal open={premiumOpen} onClose={() => setPremiumOpen(false)} />

      {modeOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-xl sm:p-6">
            <h2 className="text-lg font-bold text-[#2D5A27] sm:text-xl">{t.diet.modeModalTitle}</h2>
            <p className="mt-1 text-sm text-neutral-600">{t.diet.modeModalDesc}</p>
            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={() => pickMode("pantry")}
                className="flex w-full flex-col gap-1 rounded-2xl border border-[#2D5A27]/15 bg-[#faf8f5] p-4 text-left transition hover:border-[#2D5A27]/45 hover:bg-white"
              >
                <span className="text-sm font-bold text-[#2D5A27]">📦 {t.diet.modePantryTitle}</span>
                <span className="text-xs leading-relaxed text-neutral-600">{t.diet.modePantryDesc}</span>
              </button>
              <button
                type="button"
                onClick={() => pickMode("dietitian")}
                className="flex w-full flex-col gap-1 rounded-2xl border border-[#F28C28]/30 bg-[#fff7ec] p-4 text-left transition hover:border-[#F28C28]/60 hover:bg-white"
              >
                <span className="text-sm font-bold text-[#d07113]">🥗 {t.diet.modeDietitianTitle}</span>
                <span className="text-xs leading-relaxed text-neutral-700">{t.diet.modeDietitianDesc}</span>
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

      {freqOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-xl sm:p-6">
            <h2 className="text-lg font-bold text-[#2D5A27] sm:text-xl">{t.diet.freqModalTitle}</h2>
            <p className="mt-1 text-sm text-neutral-600">{t.diet.freqModalDesc}</p>

            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={() => setFreqChoice("single")}
                className={`flex w-full flex-col gap-1 rounded-2xl border p-4 text-left transition ${
                  freqChoice === "single"
                    ? "border-[#2D5A27] bg-[#2D5A27]/5"
                    : "border-neutral-200 bg-white hover:border-[#2D5A27]/40"
                }`}
              >
                <span className="text-sm font-bold text-[#2D5A27]">📅 {t.diet.freqSingle}</span>
                <span className="text-xs text-neutral-600">{t.diet.freqSingleDesc}</span>
              </button>

              <button
                type="button"
                onClick={() => setFreqChoice("multi")}
                className={`flex w-full flex-col gap-1 rounded-2xl border p-4 text-left transition ${
                  freqChoice === "multi"
                    ? "border-[#F28C28] bg-[#fff7ec]"
                    : "border-neutral-200 bg-white hover:border-[#F28C28]/40"
                }`}
              >
                <span className="text-sm font-bold text-[#d07113]">🗓️ {t.diet.freqMulti}</span>
                <span className="text-xs text-neutral-700">{t.diet.freqMultiDesc}</span>
              </button>

              {freqChoice === "multi" && (
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#faf8f5] p-2">
                  <button
                    type="button"
                    onClick={() => setSpanChoice("weekly")}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      spanChoice === "weekly"
                        ? "bg-white text-[#2D5A27] shadow-sm"
                        : "text-neutral-500 hover:text-[#2D5A27]"
                    }`}
                  >
                    {t.diet.spanWeekly}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpanChoice("monthly")}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      spanChoice === "monthly"
                        ? "bg-white text-[#2D5A27] shadow-sm"
                        : "text-neutral-500 hover:text-[#2D5A27]"
                    }`}
                  >
                    {t.diet.spanMonthly}
                  </button>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-[#2D5A27]">
                  {t.diet.budgetLabel}
                </label>
                <input
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className={inputCls}
                  placeholder={t.diet.budgetPlaceholder}
                  inputMode="numeric"
                />
                <p className="mt-1 text-[11px] text-neutral-500">{t.diet.budgetHint}</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#2D5A27]">
                  {t.diet.targetKcalLabel}
                </label>
                <input
                  value={targetKcal}
                  onChange={(e) => setTargetKcal(e.target.value)}
                  className={inputCls}
                  placeholder={t.diet.targetKcalPlaceholder}
                  inputMode="numeric"
                />
                <p className="mt-1 text-[11px] text-neutral-500">{t.diet.targetKcalHint}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setFreqOpen(false)}
                className="rounded-full border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                {t.diet.modeCancel}
              </button>
              <button
                type="button"
                onClick={() => runPlan(false)}
                className="rounded-full bg-[#2D5A27] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#234822]"
              >
                {t.diet.freqGo}
              </button>
            </div>
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
            <label className="text-xs font-semibold text-[#2D5A27]">{t.diet.targetWeight}</label>
            <input
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              className={inputCls}
              placeholder="65"
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
              <option value="kalori_acigi">{t.diet.deficit}</option>
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

        <div>
          <p className="text-xs font-semibold text-[#2D5A27]">{t.diet.styleLabel}</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(
              [
                { id: "standard", label: t.diet.styleStandard, icon: "🍽️" },
                { id: "keto", label: t.diet.styleKeto, icon: "🥑" },
                { id: "omad", label: t.diet.styleOmad, icon: "🌙" },
              ] as { id: DietStyle; label: string; icon: string }[]
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setDietStyle(s.id)}
                className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-2xl border px-3 py-2 text-xs font-bold transition ${
                  dietStyle === s.id
                    ? "border-[#2D5A27] bg-[#2D5A27] text-white shadow-sm"
                    : "border-neutral-200 bg-white text-[#2D5A27] hover:border-[#2D5A27]/40"
                }`}
              >
                <span className="text-lg leading-none">{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>

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

      {(loading || plan) && (
        <section className="mt-6 rounded-2xl border border-[#2D5A27]/12 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
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
              {activeFrequency && (
                <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-700">
                  {activeFrequency === "single"
                    ? t.diet.freqSingle
                    : activeFrequency === "weekly"
                    ? t.diet.spanWeekly
                    : t.diet.spanMonthly}
                </span>
              )}
            </div>
            {plan && !loading && (isPremium || isOwner) && (
              <button
                type="button"
                onClick={regenerateActive}
                className="rounded-full border border-[#2D5A27]/30 px-3 py-1.5 text-xs font-semibold text-[#2D5A27] transition hover:bg-[#2D5A27]/5"
              >
                {t.diet.regenerate}
              </button>
            )}
          </div>

          {loading && !plan && (
            <p className="mt-3 text-sm text-neutral-500">{t.diet.calcLoading}</p>
          )}

          {plan?.type === "single" && (
            <div className="mt-3 space-y-3">
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
                {plan.planText}
              </div>
              {plan.exercise && plan.exercise.trim() && (
                <div className="rounded-2xl bg-[#fff7ec] p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#d07113]">
                    {t.diet.exerciseTitle}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">
                    {plan.exercise}
                  </p>
                </div>
              )}
            </div>
          )}

          {plan?.type === "multi" && (
            <div className="mt-3 space-y-4">
              {plan.intro && (
                <div className="rounded-2xl bg-[#faf8f5] p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#2D5A27]">
                    {t.diet.introTitle}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">
                    {plan.intro}
                  </p>
                </div>
              )}
              {plan.budgetSummary && (
                <div className="rounded-2xl bg-[#fff7ec] p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#d07113]">
                    {t.diet.budgetTitle}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">
                    {plan.budgetSummary}
                  </p>
                </div>
              )}
              {plan.exercise && plan.exercise.trim() && (
                <div className="rounded-2xl bg-[#2D5A27]/8 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#2D5A27]">
                    {t.diet.exerciseTitle}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">
                    {plan.exercise}
                  </p>
                </div>
              )}

              {plan.weeks.length > 1 && (
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {plan.weeks.map((w, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setActiveWeek(i);
                        setActiveDay(0);
                      }}
                      className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition ${
                        activeWeek === i
                          ? "border-[#2D5A27] bg-[#2D5A27] text-white"
                          : "border-neutral-200 bg-white text-[#2D5A27] hover:border-[#2D5A27]/50"
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {(plan.weeks[activeWeek]?.days ?? []).map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveDay(i)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      activeDay === i
                        ? "border-[#F28C28] bg-[#F28C28] text-white"
                        : "border-neutral-200 bg-white text-neutral-700 hover:border-[#F28C28]/50"
                    }`}
                  >
                    {d.dayName}
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-[#2D5A27]/10 bg-[#faf8f5] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#2D5A27]">
                  {plan.weeks[activeWeek]?.label} · {plan.weeks[activeWeek]?.days[activeDay]?.dayName}
                </p>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-neutral-800">
                  {plan.weeks[activeWeek]?.days[activeDay]?.content}
                </pre>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
