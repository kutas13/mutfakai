"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { StockRow } from "@/types/stock";
import { formatDisplay, type BaseUnit } from "@/lib/inventory/units";
import { useLang } from "@/lib/i18n/context";

export function PantrySidebar({ revision }: { revision: number }) {
  const { t } = useLang();
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data, error } = await sb
      .from("stocks")
      .select("id, user_id, item_name, quantity, unit")
      .order("created_at", { ascending: false });

    if (error) {
      setRows([]);
    } else {
      setRows(
        (data ?? []).map((r) => ({
          id: r.id as string,
          user_id: r.user_id as string,
          item_name: r.item_name as string,
          quantity: Number(r.quantity),
          unit: r.unit as StockRow["unit"],
        })),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load, revision]);

  return (
    <div className="sticky top-24 overflow-hidden rounded-3xl border border-[#2D5A27]/12 bg-white shadow-md">
      <div className="border-b border-[#2D5A27]/10 bg-[#faf8f5] px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[#F28C28]">{t.chef.pantryTitle}</p>
        <p className="text-sm font-semibold text-[#2D5A27]">{t.chef.pantryStock}</p>
      </div>
      <div className="max-h-[min(520px,65vh)] overflow-y-auto p-4">
        {loading ? (
          <p className="text-sm text-neutral-500">Yükleniyor…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-neutral-600">
            {t.chef.pantryEmpty}{" "}
            <a href="/mutfak" className="font-semibold text-[#2D5A27] underline">
              {t.chef.pantryLink}
            </a>
            .
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-2xl border border-[#2D5A27]/10 bg-[#faf8f5]/80 px-3 py-2.5 text-sm"
              >
                <span className="font-medium text-neutral-900">{r.item_name}</span>
                <span className="shrink-0 tabular-nums text-neutral-600">
                  {formatDisplay(r.quantity, r.unit as BaseUnit)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
