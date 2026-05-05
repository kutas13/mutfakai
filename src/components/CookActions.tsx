"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { RecipeIngredient } from "@/lib/recipes/catalog";

type CookResponse =
  | { ok: true }
  | { error: string; missing?: { name: string; need: number; unit: string; have: number }[] };

export function UsePantryButton({
  recipeSlug,
  label = "Malzemeleri Mutfaktan Kullan",
}: {
  recipeSlug: string;
  label?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onCook() {
    setMsg(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push(`/auth?next=${encodeURIComponent("/hazir-yemekler")}`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/cook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeSlug }),
      });
      const data = (await res.json()) as CookResponse;

      if (!res.ok) {
        const m = data as Extract<CookResponse, { error: string }>;
        if (m.missing?.length) {
          const detail = m.missing
            .map(
              (x) =>
                `${x.name}: gerekli ${x.need} ${x.unit}, mutfakta ${x.have} ${x.unit}`,
            )
            .join(" · ");
          setMsg(`${m.error} ${detail}`);
        } else {
          setMsg(m.error || "İşlem tamamlanamadı");
        }
        return;
      }

      setMsg("Mutfak stoğun güncellendi!");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onCook}
        disabled={loading}
        className="rounded-full bg-[#F28C28] px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-[#e07d1f] disabled:opacity-60"
      >
        {loading ? "İşleniyor…" : label}
      </button>
      {msg && (
        <p className="text-xs text-neutral-700" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}

export function IngredientList({ items }: { items: RecipeIngredient[] }) {
  return (
    <ul className="mt-3 space-y-1.5 text-sm text-neutral-800">
      {items.map((i) => (
        <li
          key={`${i.name}-${i.unit}-${i.quantity}`}
          className="flex justify-between gap-3 rounded-lg bg-white/70 px-3 py-2"
        >
          <span>{i.name}</span>
          <span className="tabular-nums text-neutral-600">
            {i.quantity} {i.unit}
          </span>
        </li>
      ))}
    </ul>
  );
}
