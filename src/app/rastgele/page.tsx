"use client";

import { useMemo, useRef, useState } from "react";
import { useLang } from "@/lib/i18n/context";
import {
  INGREDIENT_CATALOG,
  type IngredientCatalogItem,
  type IngredientCategory,
} from "@/lib/inventory/ingredient-catalog";

type CategoryTab = IngredientCategory | "all";

type RecipeIdea = {
  name: string;
  description: string;
};

export default function RastgelePage() {
  const { t, lang } = useLang();

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryTab>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [ideas, setIdeas] = useState<RecipeIdea[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalDish, setModalDish] = useState<RecipeIdea | null>(null);
  const [servings, setServings] = useState(2);

  const [recipe, setRecipe] = useState<string>("");
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [activeDishName, setActiveDishName] = useState<string | null>(null);

  const ideasRef = useRef<HTMLDivElement | null>(null);
  const recipeRef = useRef<HTMLDivElement | null>(null);

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
    setError(null);
    setSelectedIds((prev) =>
      prev.includes(itemId) ? prev.filter((x) => x !== itemId) : [...prev, itemId],
    );
  }

  function clearAll() {
    setSelectedIds([]);
  }

  async function fetchIdeas() {
    setError(null);
    if (selectedItems.length === 0) {
      setError(t.random.selectAtLeastOne);
      return;
    }
    setIdeasLoading(true);
    setIdeas([]);
    setRecipe("");
    setActiveDishName(null);

    const ingredientNames = selectedItems.map((it) =>
      lang === "en" ? it.nameEn : it.nameTr,
    );

    try {
      const res = await fetch("/api/random-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: ingredientNames, lang }),
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

    const ingredientNames = selectedItems.map((it) =>
      lang === "en" ? it.nameEn : it.nameTr,
    );

    try {
      const res = await fetch("/api/random-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dishName: dish.name,
          servings,
          ingredients: ingredientNames,
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

  const trayHeight = selectedItems.length > 0 ? 220 : 0;

  return (
    <div
      className="mx-auto w-full max-w-5xl px-3 pb-16 pt-4 sm:px-5 sm:pt-6"
      style={{ paddingBottom: `${64 + trayHeight}px` }}
    >
      {/* HEADER */}
      <header className="mb-3 text-center sm:mb-5 sm:text-left">
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

      {/* STICKY SEARCH + TABS */}
      <div className="sticky top-0 z-20 -mx-3 bg-gradient-to-b from-[#faf8f5] via-[#faf8f5] to-[#faf8f5]/80 px-3 pb-2 pt-2 backdrop-blur sm:-mx-5 sm:px-5">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.kitchen.searchPlaceholder}
            className="min-h-12 w-full rounded-2xl border border-neutral-200 bg-white pl-11 pr-4 text-sm shadow-sm outline-none placeholder:text-neutral-400 focus:border-[#2D5A27]/40 focus:ring-2 focus:ring-[#2D5A27]/15"
          />
        </div>

        <div className="mt-3">
          <h2 className="text-sm font-bold text-[#2D5A27] sm:text-base">
            {t.random.pickHint}
          </h2>
        </div>

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

      {/* IDEAS */}
      {(ideasLoading || ideas.length > 0) && (
        <section ref={ideasRef} className="mt-8">
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
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800 sm:text-[15px]">
              {recipe || (
                <span className="text-neutral-400">{t.random.recipeStreaming}</span>
              )}
            </div>
          </article>
        </section>
      )}

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
                onClick={clearAll}
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
              onClick={() => void fetchIdeas()}
              disabled={ideasLoading}
              className="mt-3 min-h-12 w-full rounded-full bg-[#F28C28] py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#e07d1f] disabled:opacity-60"
            >
              {ideasLoading ? t.random.thinking : t.random.askButton}
            </button>
          </div>
        </div>
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
            <span className="font-bold text-[#2D5A27]">{dishName}</span>{" "}
            {t.random.modalQuestion}
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
                if (!Number.isNaN(n))
                  setServings(Math.max(1, Math.min(20, Math.floor(n))));
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
