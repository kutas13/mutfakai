"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n/context";
import {
  INGREDIENT_CATALOG,
  type IngredientCatalogItem,
  type IngredientCategory,
} from "@/lib/inventory/ingredient-catalog";
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

type CategoryTab = IngredientCategory | "all";

type DraftItem = {
  id: string;
  quantity: string;
  unit: InputUnit;
};

export default function MutfakPage() {
  const { t, lang } = useLang();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryTab>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, DraftItem>>({});
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

  useEffect(() => {
    void load();
  }, [load]);

  const categoryTabs: { id: CategoryTab; label: string }[] = useMemo(
    () => [
      { id: "all", label: t.kitchen.categoryAll },
      { id: "spice", label: t.kitchen.categorySpice },
      { id: "meat", label: t.kitchen.categoryMeat },
      { id: "vegFruit", label: t.kitchen.categoryVegFruit },
      { id: "grain", label: t.kitchen.categoryGrain },
      { id: "dairy", label: t.kitchen.categoryDairy },
    ],
    [t],
  );

  const visibleItems = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    return INGREDIENT_CATALOG.filter((item) => {
      if (activeCategory !== "all" && item.category !== activeCategory) return false;
      if (!q) return true;
      const tr = item.nameTr.toLocaleLowerCase("tr-TR");
      const en = item.nameEn.toLocaleLowerCase("en-US");
      return tr.includes(q) || en.includes(q);
    });
  }, [search, activeCategory]);

  const selectedItems = useMemo<IngredientCatalogItem[]>(() => {
    const map = new Map(INGREDIENT_CATALOG.map((it) => [it.id, it] as const));
    return selectedIds
      .map((id) => map.get(id))
      .filter((it): it is IngredientCatalogItem => Boolean(it));
  }, [selectedIds]);

  function toggleSelect(itemId: string) {
    setSuccessMsg(null);
    setSelectedIds((prev) =>
      prev.includes(itemId) ? prev.filter((x) => x !== itemId) : [...prev, itemId],
    );
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  function openQuantityModal() {
    if (!selectedItems.length) return;
    const next: Record<string, DraftItem> = {};
    for (const it of selectedItems) {
      next[it.id] = drafts[it.id] ?? {
        id: it.id,
        quantity: "",
        unit: it.defaultUnit,
      };
    }
    setDrafts(next);
    setModalOpen(true);
  }

  async function saveAll() {
    setError(null);
    setSaving(true);
    try {
      const sb = createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) {
        setError("Auth required");
        setSaving(false);
        return;
      }

      const inserts: {
        user_id: string;
        item_name: string;
        quantity: number;
        unit: BaseUnit;
      }[] = [];
      const auditPayloads: {
        item_name: string;
        input_quantity: number;
        input_unit: InputUnit;
        stored_quantity: number;
        stored_unit: BaseUnit;
      }[] = [];

      for (const it of selectedItems) {
        const draft = drafts[it.id];
        if (!draft) continue;
        const q = Number(draft.quantity.replace(",", "."));
        if (Number.isNaN(q) || q <= 0) {
          setError(t.kitchen.invalidInput);
          setSaving(false);
          return;
        }
        const itemName = lang === "en" ? it.nameEn : it.nameTr;
        const base = toBaseUnit(q, draft.unit, itemName);
        const stored = Number(base.quantity.toFixed(3));
        inserts.push({
          user_id: user.id,
          item_name: itemName,
          quantity: stored,
          unit: base.unit,
        });
        auditPayloads.push({
          item_name: itemName,
          input_quantity: q,
          input_unit: draft.unit,
          stored_quantity: stored,
          stored_unit: base.unit,
        });
      }

      if (!inserts.length) {
        setSaving(false);
        return;
      }

      const { error: insertErr } = await sb.from("stocks").insert(inserts);
      if (insertErr) {
        setError(insertErr.message);
        setSaving(false);
        return;
      }

      await sb.from("admin_audit_logs").insert(
        auditPayloads.map((p) => ({
          user_id: user.id,
          event_type: "stock_add",
          payload: p,
        })),
      );

      setModalOpen(false);
      setSelectedIds([]);
      setDrafts({});
      setSuccessMsg(t.kitchen.addedToKitchen);
      await load();
    } finally {
      setSaving(false);
    }
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

  const trayHeight = selectedItems.length > 0 ? 220 : 0;

  return (
    <div
      className="mx-auto w-full max-w-5xl px-3 pb-6 pt-4 sm:px-5"
      style={{ paddingBottom: `${24 + trayHeight}px` }}
    >
      {/* HEADER */}
      <header className="mb-3">
        <h1 className="text-xl font-bold text-[#2D5A27] sm:text-2xl">
          {t.kitchen.title}
        </h1>
        <p className="mt-1 text-xs text-neutral-600 sm:text-sm">
          {t.kitchen.subtitle}
        </p>
      </header>

      {/* STICKY SEARCH + TABS */}
      <div className="sticky top-0 z-20 -mx-3 bg-gradient-to-b from-[#faf8f5] via-[#faf8f5] to-[#faf8f5]/80 px-3 pb-2 pt-2 backdrop-blur sm:-mx-5 sm:px-5">
        {/* Search Bar */}
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.kitchen.searchPlaceholder}
            className="min-h-12 w-full rounded-2xl border border-neutral-200 bg-white pl-11 pr-4 text-sm shadow-sm outline-none placeholder:text-neutral-400 focus:border-[#2D5A27]/40 focus:ring-2 focus:ring-[#2D5A27]/15"
          />
        </div>

        {/* Title row with + */}
        <div className="mt-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#2D5A27] sm:text-base">
              {t.kitchen.pickFromKitchen}
            </h2>
            <p className="mt-0.5 text-[11px] text-neutral-500 sm:text-xs">
              {t.kitchen.pickFromKitchenHint}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setActiveCategory("all");
            }}
            aria-label="Reset filters"
            className="grid h-10 w-10 place-items-center rounded-full bg-[#2D5A27]/10 text-[#2D5A27] transition hover:bg-[#2D5A27]/15"
          >
            <PlusIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="-mx-3 mt-3 overflow-x-auto px-3 sm:-mx-5 sm:px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-2">
            {categoryTabs.map((tab) => {
              const isActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id)}
                  className={`min-h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-xs font-semibold transition sm:text-sm ${
                    isActive
                      ? "border-[#2D5A27] bg-[#2D5A27] text-white shadow"
                      : "border-neutral-200 bg-white text-neutral-600 hover:border-[#2D5A27]/40 hover:text-[#2D5A27]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {successMsg && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMsg}
        </p>
      )}

      {/* GRID */}
      <section className="mt-4">
        {visibleItems.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-200 bg-white px-6 py-10 text-center text-sm text-neutral-500">
            {t.kitchen.nothingFound}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6">
            {visibleItems.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              const name = lang === "en" ? item.nameEn : item.nameTr;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleSelect(item.id)}
                  aria-pressed={isSelected}
                  className={`group relative flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border bg-white p-2 text-center shadow-sm transition active:scale-95 sm:gap-1.5 sm:p-3 ${
                    isSelected
                      ? "border-transparent ring-2 ring-[#2D5A27]"
                      : "border-neutral-100 hover:border-[#2D5A27]/40 hover:shadow"
                  }`}
                >
                  <span
                    className="select-none text-3xl leading-none sm:text-4xl"
                    aria-hidden
                  >
                    {item.emoji}
                  </span>
                  <span className="line-clamp-2 text-[11px] font-medium text-neutral-800 sm:text-xs">
                    {name}
                  </span>
                  {isSelected && (
                    <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#2D5A27] text-[10px] font-bold text-white shadow">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* CURRENT INVENTORY */}
      <section className="mt-8">
        <div className="overflow-hidden rounded-2xl border border-[#2D5A27]/12 bg-white shadow-sm">
          <div className="border-b border-neutral-100 bg-[#faf8f5] px-4 py-3 text-sm font-semibold text-[#2D5A27]">
            {t.kitchen.inventoryList}
          </div>
          {loading ? (
            <p className="p-8 text-center text-sm text-neutral-500">…</p>
          ) : rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-neutral-500">
              {t.kitchen.emptyState}
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <span className="flex-1 text-sm font-medium text-neutral-900">
                    {r.item_name}
                  </span>
                  <span className="tabular-nums text-sm text-neutral-600">
                    {formatDisplay(r.quantity, r.unit)}
                  </span>
                  <QuickEdit
                    initial={r.quantity}
                    onSave={(v) => updateRow(r.id, v)}
                  />
                  <button
                    type="button"
                    onClick={() => deleteRow(r.id)}
                    className="text-xs font-semibold text-red-600 hover:underline"
                  >
                    {t.kitchen.delete}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* BOTTOM TRAY */}
      {selectedItems.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-100 bg-white pb-[max(env(safe-area-inset-bottom),0px)] shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
          <div className="mx-auto w-full max-w-5xl px-3 py-3 sm:px-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#2D5A27]">
                {t.kitchen.selected} ({selectedItems.length})
              </span>
              <button
                type="button"
                onClick={clearSelection}
                className="min-h-10 rounded-full px-3 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                {t.kitchen.clearAll}
              </button>
            </div>

            <div className="-mx-3 mt-2 flex gap-2 overflow-x-auto px-3 pb-1 sm:-mx-5 sm:px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {selectedItems.map((item) => {
                const name = lang === "en" ? item.nameEn : item.nameTr;
                return (
                  <span
                    key={item.id}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#2D5A27]/10 py-1.5 pl-3 pr-1.5 text-xs font-semibold text-[#2D5A27]"
                  >
                    <span aria-hidden>{item.emoji}</span>
                    <span>{name}</span>
                    <button
                      type="button"
                      onClick={() => toggleSelect(item.id)}
                      aria-label="Remove"
                      className="grid h-5 w-5 place-items-center rounded-full bg-[#2D5A27]/15 text-[10px] hover:bg-[#2D5A27]/25"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>

            <button
              type="button"
              onClick={openQuantityModal}
              className="mt-3 min-h-12 w-full rounded-full bg-[#2D5A27] py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#234822]"
            >
              {t.kitchen.addToKitchen}
            </button>
          </div>
        </div>
      )}

      {/* QUANTITY MODAL */}
      {modalOpen && (
        <QuantityModal
          items={selectedItems}
          drafts={drafts}
          setDrafts={setDrafts}
          onClose={() => setModalOpen(false)}
          onSave={saveAll}
          saving={saving}
        />
      )}
    </div>
  );
}

/* -------------------- Subcomponents -------------------- */

function QuantityModal({
  items,
  drafts,
  setDrafts,
  onClose,
  onSave,
  saving,
}: {
  items: IngredientCatalogItem[];
  drafts: Record<string, DraftItem>;
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, DraftItem>>>;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const { t, lang } = useLang();

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-start justify-between border-b border-neutral-100 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-[#2D5A27]">
              {t.kitchen.modalTitle}
            </h3>
            <p className="mt-1 text-xs text-neutral-500">{t.kitchen.modalHint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full text-neutral-500 hover:bg-neutral-100"
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {items.map((item) => {
            const draft =
              drafts[item.id] ?? {
                id: item.id,
                quantity: "",
                unit: item.defaultUnit,
              };
            const name = lang === "en" ? item.nameEn : item.nameTr;
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-2xl border border-neutral-100 bg-[#faf8f5] p-3"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-2xl shadow-sm">
                  {item.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">
                    {name}
                  </p>
                  <div className="mt-2 grid grid-cols-5 gap-2">
                    <input
                      inputMode="decimal"
                      value={draft.quantity}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [item.id]: { ...draft, quantity: e.target.value },
                        }))
                      }
                      placeholder="0"
                      className="col-span-2 min-h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm tabular-nums outline-none focus:ring-2 focus:ring-[#2D5A27]/25"
                    />
                    <select
                      value={draft.unit}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [item.id]: {
                            ...draft,
                            unit: e.target.value as InputUnit,
                          },
                        }))
                      }
                      className="col-span-3 min-h-10 rounded-xl border border-neutral-200 bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-[#2D5A27]/25"
                    >
                      {INPUT_UNITS.map((u) => (
                        <option key={u.value} value={u.value}>
                          {lang === "en" ? u.labelEn : u.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 border-t border-neutral-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-h-12 flex-1 rounded-full border border-neutral-200 bg-white text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
          >
            {t.kitchen.cancel}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="min-h-12 flex-1 rounded-full bg-[#2D5A27] text-sm font-bold text-white shadow transition hover:bg-[#234822] disabled:opacity-60"
          >
            {saving ? t.kitchen.saving : t.kitchen.saveAll}
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickEdit({
  initial,
  onSave,
}: {
  initial: number;
  onSave: (v: number) => void;
}) {
  const [val, setVal] = useState(String(initial));
  useEffect(() => {
    setVal(String(initial));
  }, [initial]);
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(val.replace(",", "."));
        if (!Number.isNaN(n)) onSave(n);
      }}
    >
      <input
        className="w-20 rounded-lg border border-neutral-200 px-2 py-1 text-xs tabular-nums"
        value={val}
        onChange={(e) => setVal(e.target.value)}
      />
      <button
        type="submit"
        className="rounded-lg bg-[#F28C28]/15 px-2 py-1 text-xs font-semibold text-[#c56f18]"
      >
        OK
      </button>
    </form>
  );
}

/* -------------------- Icons -------------------- */

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function PlusIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
