"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n/context";
import { formatDisplay, type BaseUnit } from "@/lib/inventory/units";

type StockRow = {
  id: string;
  item_name: string;
  quantity: number;
  unit: BaseUnit;
};

type RecipeIdea = {
  name: string;
  description: string;
};

export default function RastgelePage() {
  const { t, lang } = useLang();
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [loadingPantry, setLoadingPantry] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);

  const [ideas, setIdeas] = useState<RecipeIdea[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalDish, setModalDish] = useState<RecipeIdea | null>(null);
  const [servings, setServings] = useState(2);

  const [recipe, setRecipe] = useState<string>("");
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [activeDishName, setActiveDishName] = useState<string | null>(null);

  const recipeRef = useRef<HTMLDivElement | null>(null);
  const ideasRef = useRef<HTMLDivElement | null>(null);

  const loadPantry = useCallback(async () => {
    const sb = createClient();
    const { data, error: err } = await sb
      .from("stocks")
      .select("id, item_name, quantity, unit")
      .order("created_at", { ascending: false });
    if (!err) {
      setStocks(
        (data ?? []).map((r) => ({
          id: r.id,
          item_name: r.item_name,
          quantity: Number(r.quantity),
          unit: r.unit as BaseUnit,
        })),
      );
    }
    setLoadingPantry(false);
  }, []);

  useEffect(() => {
    void loadPantry();
  }, [loadPantry]);

  function toggle(itemName: string) {
    setSelected((prev) =>
      prev.includes(itemName)
        ? prev.filter((x) => x !== itemName)
        : [...prev, itemName],
    );
  }

  function selectAll() {
    setSelected(stocks.map((s) => s.item_name));
  }

  function clearAll() {
    setSelected([]);
  }

  async function fetchIdeas() {
    setError(null);
    if (selected.length === 0) {
      setError(t.random.selectAtLeastOne);
      return;
    }
    setIdeasLoading(true);
    setIdeas([]);
    setRecipe("");
    setActiveDishName(null);
    try {
      const res = await fetch("/api/random-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: selected, lang }),
      });
      if (!res.ok) {
        const txt = await res.text();
        setError(txt || "Failed to fetch ideas");
        return;
      }
      const json = (await res.json()) as { ideas: RecipeIdea[] };
      setIdeas(json.ideas ?? []);
      setTimeout(() => {
        ideasRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setIdeasLoading(false);
    }
  }

  function openModal(dish: RecipeIdea) {
    setModalDish(dish);
    setServings(2);
  }

  async function submitModal() {
    if (!modalDish) return;
    const dish = modalDish;
    setModalDish(null);
    setRecipe("");
    setRecipeLoading(true);
    setActiveDishName(dish.name);
    setTimeout(() => {
      recipeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);

    try {
      const res = await fetch("/api/random-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dishName: dish.name,
          servings,
          ingredients: selected,
          lang,
        }),
      });
      if (!res.ok || !res.body) {
        const txt = await res.text();
        setError(txt || "Failed to fetch recipe");
        setRecipeLoading(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setRecipe(acc);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stream error");
    } finally {
      setRecipeLoading(false);
    }
  }

  const sortedStocks = useMemo(() => stocks, [stocks]);

  return (
    <div className="mx-auto w-full max-w-4xl px-3 pb-16 pt-4 sm:px-6 sm:pt-8">
      {/* HEADER */}
      <header className="mb-5 text-center sm:mb-7 sm:text-left">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#F28C28]">
          MutfakAI
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[#2D5A27] sm:text-3xl">
          {t.random.title}
        </h1>
        <p className="mt-2 text-sm text-neutral-600 sm:text-[15px]">
          {t.random.subtitle}
        </p>
      </header>

      {/* PANTRY CHIPS */}
      <section className="rounded-3xl border border-[#2D5A27]/12 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#2D5A27] sm:text-base">
            {t.random.pickHint}
          </h2>
          {sortedStocks.length > 0 && (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={selectAll}
                className="min-h-9 rounded-full border border-[#2D5A27]/25 bg-white px-3 text-[11px] font-semibold text-[#2D5A27] transition hover:bg-[#2D5A27]/5 sm:text-xs"
              >
                {t.random.selectAll}
              </button>
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="min-h-9 rounded-full px-3 text-[11px] font-semibold text-red-600 transition hover:bg-red-50 sm:text-xs"
                >
                  {t.random.clearAll}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mt-3">
          {loadingPantry ? (
            <p className="py-6 text-center text-sm text-neutral-500">…</p>
          ) : sortedStocks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-[#faf8f5] px-4 py-6 text-center">
              <p className="text-sm text-neutral-600">{t.random.pantryEmpty}</p>
              <Link
                href="/mutfak"
                className="mt-3 inline-flex min-h-10 items-center rounded-full bg-[#2D5A27] px-4 text-xs font-semibold text-white shadow transition hover:bg-[#234822]"
              >
                {t.random.pantryEmptyAction}
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sortedStocks.map((row) => {
                const isSelected = selected.includes(row.item_name);
                return (
                  <button
                    key={row.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggle(row.item_name)}
                    className={`group inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition active:scale-95 sm:text-sm ${
                      isSelected
                        ? "border-transparent bg-[#2D5A27] text-white shadow"
                        : "border-neutral-200 bg-white text-neutral-700 hover:border-[#2D5A27]/40 hover:text-[#2D5A27]"
                    }`}
                  >
                    <span>{row.item_name}</span>
                    <span
                      className={`tabular-nums text-[10px] ${
                        isSelected
                          ? "text-white/80"
                          : "text-neutral-400 group-hover:text-[#2D5A27]/70"
                      }`}
                    >
                      {formatDisplay(row.quantity, row.unit)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {sortedStocks.length > 0 && (
          <button
            type="button"
            onClick={() => void fetchIdeas()}
            disabled={ideasLoading || selected.length === 0}
            className="mt-4 min-h-12 w-full rounded-full bg-[#F28C28] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#e07d1f] disabled:opacity-50"
          >
            {ideasLoading ? t.random.thinking : t.random.askButton}
          </button>
        )}

        {error && (
          <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-xs text-red-700">
            {error}
          </p>
        )}
      </section>

      {/* IDEAS */}
      {(ideasLoading || ideas.length > 0) && (
        <section ref={ideasRef} className="mt-6">
          <h2 className="mb-3 text-base font-bold text-[#2D5A27] sm:text-lg">
            {t.random.ideasReady}
          </h2>

          {ideasLoading && (
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-2xl border border-neutral-100 bg-white"
                />
              ))}
            </div>
          )}

          {!ideasLoading && ideas.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {ideas.map((idea, idx) => (
                <article
                  key={`${idea.name}-${idx}`}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-[#2D5A27]/10 bg-white p-4 shadow-sm transition hover:border-[#2D5A27]/30 hover:shadow-md sm:flex-row sm:items-center"
                >
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-[#2D5A27]">
                      {idea.name}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-600 sm:text-sm">
                      {idea.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openModal(idea)}
                    className="min-h-11 shrink-0 rounded-full bg-[#2D5A27] px-5 text-sm font-bold text-white shadow transition hover:bg-[#234822]"
                  >
                    {t.random.cookButton}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* RECIPE STREAM */}
      {(recipeLoading || recipe) && (
        <section ref={recipeRef} className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F28C28]">
                {recipeLoading ? t.random.recipeStreaming : t.random.recipeReady}
              </p>
              {activeDishName && (
                <h2 className="mt-0.5 text-lg font-bold text-[#2D5A27] sm:text-xl">
                  {activeDishName}
                </h2>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setRecipe("");
                setActiveDishName(null);
                setTimeout(() => {
                  ideasRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }, 50);
              }}
              className="min-h-9 rounded-full border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-600 hover:border-[#2D5A27]/40 hover:text-[#2D5A27]"
            >
              {t.random.backToIdeas}
            </button>
          </div>

          <article className="rounded-3xl border border-[#2D5A27]/15 bg-white p-4 shadow-sm sm:p-6">
            <div className="prose-recipe whitespace-pre-wrap text-sm leading-relaxed text-neutral-800 sm:text-[15px]">
              {recipe || (
                <span className="text-neutral-400">
                  {t.random.recipeStreaming}
                </span>
              )}
            </div>
          </article>
        </section>
      )}

      {/* SERVINGS MODAL */}
      {modalDish && (
        <ServingsModal
          dishName={modalDish.name}
          servings={servings}
          setServings={setServings}
          onCancel={() => setModalDish(null)}
          onSubmit={() => void submitModal()}
        />
      )}
    </div>
  );
}

function ServingsModal({
  dishName,
  servings,
  setServings,
  onCancel,
  onSubmit,
}: {
  dishName: string;
  servings: number;
  setServings: (n: number) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const { t, lang } = useLang();
  const dec = () => setServings(Math.max(1, servings - 1));
  const inc = () => setServings(Math.min(20, servings + 1));

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="px-5 pt-5">
          <p className="text-xs font-bold uppercase tracking-wider text-[#F28C28]">
            {t.random.modalTitle}
          </p>
          <p className="mt-2 text-base text-neutral-800 sm:text-lg">
            {lang === "tr" ? (
              <>
                <span className="font-bold text-[#2D5A27]">{dishName}</span>{" "}
                {t.random.modalQuestion}
              </>
            ) : (
              <>
                <span className="font-bold text-[#2D5A27]">{dishName}</span>{" "}
                {t.random.modalQuestion}
              </>
            )}
          </p>
        </div>

        <div className="px-5 py-5">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {t.random.servingsLabel}
          </label>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={dec}
              aria-label="Decrease"
              className="grid h-12 w-12 place-items-center rounded-full border border-neutral-200 bg-white text-xl font-bold text-[#2D5A27] transition hover:bg-[#2D5A27]/5 active:scale-95"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              max={20}
              value={servings}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isNaN(n)) setServings(Math.max(1, Math.min(20, Math.floor(n))));
              }}
              className="h-12 w-20 rounded-2xl border border-neutral-200 text-center text-2xl font-bold tabular-nums text-[#2D5A27] outline-none focus:ring-2 focus:ring-[#2D5A27]/25"
            />
            <button
              type="button"
              onClick={inc}
              aria-label="Increase"
              className="grid h-12 w-12 place-items-center rounded-full border border-neutral-200 bg-white text-xl font-bold text-[#2D5A27] transition hover:bg-[#2D5A27]/5 active:scale-95"
            >
              +
            </button>
            <span className="text-sm text-neutral-500">
              {lang === "tr" ? "kişilik" : servings === 1 ? "person" : "people"}
            </span>
          </div>
        </div>

        <div className="flex gap-2 border-t border-neutral-100 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 flex-1 rounded-full border border-neutral-200 bg-white text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            {t.random.modalCancel}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="min-h-12 flex-1 rounded-full bg-[#2D5A27] text-sm font-bold text-white shadow transition hover:bg-[#234822]"
          >
            {t.random.modalSubmit}
          </button>
        </div>
      </div>
    </div>
  );
}
