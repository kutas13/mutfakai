"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n/context";

export function PremiumModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLang();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Oturum gerekli"); setLoading(false); return; }

    const { error: err } = await supabase.from("premium_requests").insert({
      user_id: user.id,
      phone_number: phone.trim(),
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setDone(true);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-xs font-bold uppercase tracking-widest text-[#F28C28]">Premium</p>
        <h2 className="mt-2 text-center text-xl font-bold text-[#2D5A27]">{t.premium.modalTitle}</h2>

        <div className="mt-4 flex justify-center gap-4 text-sm">
          <span className="rounded-full bg-[#F28C28]/10 px-3 py-1.5 font-semibold text-[#F28C28]">{t.premium.monthlyPrice}</span>
          <span className="rounded-full bg-[#2D5A27]/10 px-3 py-1.5 font-semibold text-[#2D5A27]">{t.premium.yearlyPrice}</span>
        </div>

        <p className="mt-4 text-center text-sm text-neutral-600">{t.premium.description}</p>

        {done ? (
          <div className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-900">
            {t.premium.success}
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="prem-phone" className="text-sm font-medium text-[#2D5A27]">{t.premium.phoneLabel}</label>
              <input
                id="prem-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t.premium.phonePlaceholder}
                className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#2D5A27]/25"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-[#F28C28] py-3 text-sm font-semibold text-white transition hover:bg-[#e07d1f] disabled:opacity-50"
            >
              {loading ? t.premium.submitting : t.premium.submitBtn}
            </button>
          </form>
        )}

        <button type="button" onClick={onClose} className="mt-4 w-full text-center text-sm text-neutral-500 hover:underline">
          {t.premium.close}
        </button>
      </div>
    </div>
  );
}
