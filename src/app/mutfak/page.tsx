"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n/context";
import { SearchableSelect } from "@/components/SearchableSelect";
import { COMMON_INGREDIENTS } from "@/lib/inventory/ingredients-list";
import {
  INPUT_UNITS,
  toBaseUnit,
  formatDisplay,
  type InputUnit,
  type BaseUnit,
} from "@/lib/inventory/units";

type Row = {
  id: string;
  item_name: string;
  quantity: number;
  unit: BaseUnit;
};

export default function MutfakPage() {
  const { t, lang } = useLang();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<InputUnit>("gr");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const sb = createClient();
    const { data, error: err } = await sb
      .from("stocks")
      .select("id, item_name, quantity, unit")
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
      setRows([]);
    } else {
      setRows(
        (data ?? []).map((r) => ({
          id: r.id,
          item_name: r.item_name,
          quantity: Number(r.quantity),
          unit: r.unit as BaseUnit,
        })),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function addIngredient(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const q = Number(quantity.replace(",", "."));
    if (!name.trim() || Number.isNaN(q) || q <= 0) {
      setError(t.kitchen.invalidInput);
      return;
    }

    const base = toBaseUnit(q, unit, name.trim());
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    const { error: err } = await sb.from("stocks").insert({
      user_id: user.id,
      item_name: name.trim(),
      quantity: Number(base.quantity.toFixed(3)),
      unit: base.unit,
    });

    if (err) { setError(err.message); return; }
    await sb.from("admin_audit_logs").insert({
      user_id: user.id,
      event_type: "stock_add",
      payload: {
        item_name: name.trim(),
        input_quantity: q,
        input_unit: unit,
        stored_quantity: Number(base.quantity.toFixed(3)),
        stored_unit: base.unit,
      },
    });
    setName("");
    setQuantity("");
    await load();
  }

  async function updateRow(id: string, newQty: number) {
    if (newQty < 0) return;
    const sb = createClient();
    await sb.from("stocks").update({ quantity: newQty }).eq("id", id);
    await load();
  }

  async function deleteRow(id: string) {
    const sb = createClient();
    await sb.from("stocks").delete().eq("id", id);
    await load();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[#2D5A27]">{t.kitchen.title}</h1>
        <p className="mt-1 text-neutral-600">{t.kitchen.subtitle}</p>
      </header>

      <form
        onSubmit={addIngredient}
        className="mb-10 grid gap-3 rounded-2xl border border-[#2D5A27]/12 bg-white p-5 shadow-sm sm:grid-cols-12 sm:items-end"
      >
        <div className="sm:col-span-5">
          <label className="text-xs font-semibold text-[#2D5A27]">{t.kitchen.ingredient}</label>
          <div className="mt-1">
            <SearchableSelect
              options={COMMON_INGREDIENTS}
              value={name}
              onChange={setName}
              placeholder={t.kitchen.searchPlaceholder}
            />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-[#2D5A27]">{t.kitchen.quantity}</label>
          <input
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="1000"
            className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2D5A27]/25"
          />
        </div>
        <div className="sm:col-span-3">
          <label className="text-xs font-semibold text-[#2D5A27]">{t.kitchen.unit}</label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as InputUnit)}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2D5A27]/25"
          >
            {INPUT_UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {lang === "en" ? u.labelEn : u.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="w-full rounded-full bg-[#2D5A27] py-2.5 text-sm font-semibold text-white transition hover:bg-[#234822]"
          >
            {t.kitchen.add}
          </button>
        </div>
      </form>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#2D5A27]/12 bg-white shadow-sm">
        <div className="border-b border-neutral-100 bg-[#faf8f5] px-4 py-3 text-sm font-semibold text-[#2D5A27]">
          {t.kitchen.inventoryList}
        </div>
        {loading ? (
          <p className="p-8 text-center text-sm text-neutral-500">Yükleniyor…</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-neutral-500">{t.kitchen.emptyState}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-neutral-100 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">{t.kitchen.ingredient}</th>
                  <th className="px-4 py-3 font-medium">{t.kitchen.quantity}</th>
                  <th className="px-4 py-3 font-medium">{t.kitchen.update}</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-900">{r.item_name}</td>
                    <td className="px-4 py-3 tabular-nums text-neutral-700">
                      {formatDisplay(r.quantity, r.unit)}
                    </td>
                    <td className="px-4 py-3">
                      <QuickEdit initial={r.quantity} onSave={(v) => updateRow(r.id, v)} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => deleteRow(r.id)} className="text-xs font-semibold text-red-600 hover:underline">
                        {t.kitchen.delete}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function QuickEdit({ initial, onSave }: { initial: number; onSave: (v: number) => void }) {
  const [val, setVal] = useState(String(initial));
  useEffect(() => { setVal(String(initial)); }, [initial]);
  return (
    <form
      className="flex flex-wrap items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(val.replace(",", "."));
        if (!Number.isNaN(n)) onSave(n);
      }}
    >
      <input className="w-20 rounded-lg border border-neutral-200 px-2 py-1 text-xs tabular-nums" value={val} onChange={(e) => setVal(e.target.value)} />
      <button type="submit" className="rounded-lg bg-[#F28C28]/15 px-2 py-1 text-xs font-semibold text-[#c56f18]">OK</button>
    </form>
  );
}
