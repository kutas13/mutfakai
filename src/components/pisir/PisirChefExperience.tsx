"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  type UIMessage,
  type TextUIPart,
} from "ai";
import { deductRecipeFromPantry } from "@/app/actions/stock";
import type { DeductionLine } from "@/lib/inventory/deductStocks";
import { getRecipeBySlug } from "@/lib/recipes/catalog";
import { PantrySidebar } from "@/components/pisir/PantrySidebar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLang } from "@/lib/i18n/context";
import { parseDeductionsFromRecipeText } from "@/lib/inventory/recipe-parser";
import { Toggle } from "@/components/ui/toggle";
import { Badge } from "@/components/ui/badge";

const WELCOME_ID = "welcome-mutfak-chef";

type KaydetOutput = {
  recipeTitle: string;
  items: DeductionLine[];
};

type IngredientSelectionOutput = {
  recipeTitle: string;
  servings: number;
  items: Array<{
    name: string;
    isCore: boolean;
    category: "main" | "side";
  }>;
};

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is TextUIPart => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function extractKaydetPlan(messages: UIMessage[]): KaydetOutput | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    for (const part of m.parts) {
      if (
        part.type === "tool-kaydetTarifStoku" &&
        part.state === "output-available"
      ) {
        return part.output as KaydetOutput;
      }
    }
  }
  return null;
}

function extractIngredientSelection(
  messages: UIMessage[],
): IngredientSelectionOutput | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    for (const part of m.parts) {
      if (
        part.type === "tool-malzemeSecimListesi" &&
        part.state === "output-available"
      ) {
        return part.output as IngredientSelectionOutput;
      }
    }
  }
  return null;
}

export function PisirChefExperience() {
  const { t, lang } = useLang();
  const params = useSearchParams();
  const recipeParam = params.get("recipe");
  const recipeBootRef = useRef(false);

  const initialMessages: UIMessage[] = useMemo(() => [{
    id: WELCOME_ID,
    role: "assistant" as const,
    parts: [{
      type: "text" as const,
      text:
        lang === "tr"
          ? "Hoş geldin Şefim. Bu lezzeti kaç kişi için hazırlıyoruz?"
          : "Welcome Chef. How many people are we cooking for?",
      state: "done" as const,
    }],
  }], [lang]);

  const [input, setInput] = useState("");
  const [pantryRev, setPantryRev] = useState(0);
  const [cookMsg, setCookMsg] = useState<string | null>(null);
  const [cookLoading, setCookLoading] = useState(false);
  const [excludedIngredients, setExcludedIngredients] = useState<string[]>([]);
  const [selectionKey, setSelectionKey] = useState("");
  const [selectionConfirmed, setSelectionConfirmed] = useState(false);
  const [selectionInfo, setSelectionInfo] = useState<string | null>(null);

  const bumpPantry = useCallback(() => setPantryRev((x) => x + 1), []);

  const { messages, sendMessage, status, error } = useChat({
    id: "mutfak-chef-chat",
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { lang },
    }),
    onFinish: () => bumpPantry(),
  });

  useEffect(() => {
    if (!recipeParam || recipeBootRef.current) return;
    const r = getRecipeBySlug(recipeParam);
    if (!r) return;
    recipeBootRef.current = true;
    void sendMessage({
      text: `Hazır yemek kataloğundan "${r.title}" için yardım istiyorum; envanterime göre tarif ver.`,
    });
  }, [recipeParam, sendMessage]);

  const plan = useMemo(() => extractKaydetPlan(messages), [messages]);
  const ingredientSelection = useMemo(
    () => extractIngredientSelection(messages),
    [messages],
  );
  const latestAssistantText = useMemo(() => {
    const assistant = [...messages].reverse().find((m) => m.role === "assistant");
    return assistant ? getMessageText(assistant) : "";
  }, [messages]);
  const parsedPlanFromText = useMemo(
    () => parseDeductionsFromRecipeText(latestAssistantText),
    [latestAssistantText],
  );
  const cookPlan =
    plan?.items?.length ? plan.items : parsedPlanFromText;
  const recipeTitle =
    plan?.recipeTitle ?? (lang === "tr" ? "Tariften stok planı" : "Stock plan from recipe");

  useEffect(() => {
    if (!ingredientSelection) return;
    const key = `${ingredientSelection.recipeTitle}-${ingredientSelection.servings}-${ingredientSelection.items.length}`;
    if (key === selectionKey) return;
    setSelectionKey(key);
    setExcludedIngredients([]);
    setSelectionConfirmed(false);
    setSelectionInfo(null);
  }, [ingredientSelection, selectionKey]);

  async function handleSend() {
    const txt = input.trim();
    if (!txt || status !== "ready") return;
    setInput("");
    setCookMsg(null);
    await sendMessage({ text: txt });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await handleSend();
  }

  const busy = status === "streaming" || status === "submitted";

  const remainingIngredients = useMemo(() => {
    if (!ingredientSelection) return [];
    return ingredientSelection.items.filter(
      (item) => !excludedIngredients.includes(item.name),
    );
  }, [ingredientSelection, excludedIngredients]);

  async function onGenerateRecipeWithSelection() {
    if (!ingredientSelection || busy) return;
    const removed = ingredientSelection.items
      .filter((item) => excludedIngredients.includes(item.name))
      .map((item) => item.name);
    const kept = ingredientSelection.items
      .filter((item) => !excludedIngredients.includes(item.name))
      .map((item) => item.name);

    setSelectionConfirmed(true);
    setSelectionInfo(t.chef.selectionReady);
    await sendMessage({
      text:
        lang === "tr"
          ? `Malzeme seçimini tamamladım. Kişi sayısı: ${ingredientSelection.servings}. KALAN malzemeler: ${kept.join(", ") || "-"}. ÇIKARILAN malzemeler: ${removed.join(", ") || "-"}. Ana malzemeleri koruyarak bu listeye göre tarifi oluştur ve kaydetTarifStoku aracında sadece kalan malzemeleri gönder.`
          : `Ingredient selection completed. Servings: ${ingredientSelection.servings}. KEPT ingredients: ${kept.join(", ") || "-"}. REMOVED ingredients: ${removed.join(", ") || "-"}. Keep core ingredients and generate the recipe with only kept ingredients. In kaydetTarifStoku include only kept ingredients.`,
    });
  }

  function onToggleIngredient(name: string, isCore: boolean) {
    if (isCore) {
      setSelectionInfo(t.chef.coreIngredientLocked);
      return;
    }
    setSelectionInfo(null);
    setExcludedIngredients((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name],
    );
  }

  async function onCook() {
    if (!cookPlan.length) return;
    setCookLoading(true);
    setCookMsg(null);
    const res = await deductRecipeFromPantry(cookPlan);
    setCookLoading(false);
    if (!res.ok) {
      if (res.missing?.length) {
        const first = res.missing[0];
        setCookMsg(
          lang === "tr"
            ? `Şefim, dolaptaki ${first.name} bu miktar için yetersiz!`
            : `Chef, pantry stock for ${first.name} is not enough for this amount!`,
        );
      } else {
        setCookMsg(res.error);
      }
      return;
    }
    setCookMsg(t.chef.cookSuccess);
    bumpPantry();
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 lg:py-10">
      <header className="mb-5 text-center lg:mb-8 lg:text-left">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F28C28]">{t.chef.badge}</p>
        <h1 className="mt-1 text-2xl font-bold text-[#2D5A27] sm:text-3xl">{t.chef.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-600">{t.chef.subtitle}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-8">
        <aside className="order-2 lg:order-1 lg:col-span-4">
          <PantrySidebar revision={pantryRev} />
        </aside>

        <section className="order-1 space-y-4 lg:order-2 lg:col-span-8">
          <div className="flex h-[68vh] min-h-[520px] flex-col overflow-hidden rounded-3xl border border-[#2D5A27]/12 bg-gradient-to-b from-white to-[#faf8f5] shadow-md lg:h-[70vh] lg:min-h-[560px]">
            <div className="border-b border-[#2D5A27]/10 bg-[#2D5A27] px-4 py-3">
              <p className="text-sm font-semibold text-white">MutfakAI Başşef</p>
              <p className="text-xs text-white/80">{t.chef.subtitle}</p>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
              {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error.message}</p>}
              {messages.map((message) => {
                const text = getMessageText(message);
                const isSelectionPrompt =
                  message.role === "user" &&
                  (text.startsWith("Malzeme seçimini tamamladım") ||
                    text.startsWith("Ingredient selection completed"));

                if (isSelectionPrompt) {
                  return (
                    <div key={message.id} className="flex justify-end">
                      <div className="max-w-[92%] rounded-2xl border border-[#2D5A27]/20 bg-[#2D5A27]/5 px-4 py-2.5 text-xs font-semibold text-[#2D5A27] shadow-sm">
                        {lang === "tr"
                          ? "Malzeme seçimini gönderdin. Şef tarifi hazırlıyor…"
                          : "Selection sent. Chef is preparing the recipe…"}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                      message.role === "user"
                        ? "bg-[#2D5A27] text-white"
                        : "border border-[#2D5A27]/10 bg-white text-neutral-900"
                    }`}>
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide opacity-70">
                        {message.role === "user" ? (lang === "tr" ? "Sen" : "You") : (lang === "tr" ? "Başşef" : "Head Chef")}
                      </span>
                      <div className="whitespace-pre-wrap">{text}</div>
                      {message.role === "assistant" &&
                        message.parts.some((p) => p.type === "tool-kaydetTarifStoku" && p.state === "output-available") && (
                          <p className="mt-2 text-xs font-medium text-[#F28C28]">{t.chef.recipeReady}</p>
                        )}
                    </div>
                  </div>
                );
              })}
              {busy && <p className="text-xs text-neutral-500" aria-live="polite">{t.chef.thinking}</p>}

              {ingredientSelection && !selectionConfirmed && (
                <div className="rounded-2xl border border-[#2D5A27]/15 bg-white p-3">
                  <h3 className="text-sm font-semibold text-[#2D5A27]">
                    {t.chef.ingredientPickTitle}
                  </h3>
                  <p className="mt-1 text-xs text-neutral-500">{t.chef.ingredientPickHint}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ingredientSelection.items.map((item) => {
                      const excluded = excludedIngredients.includes(item.name);
                      return (
                        <Toggle
                          key={`${item.name}-${item.category}`}
                          pressed={!excluded}
                          onClick={() => onToggleIngredient(item.name, item.isCore)}
                          className="min-h-11"
                        >
                          <span>{item.name}</span>
                          {item.isCore ? (
                            <Badge className="ml-2 min-h-0 border-[#2D5A27]/25 bg-[#2D5A27]/10 px-2 py-0.5 text-[10px] text-[#2D5A27]">
                              Core
                            </Badge>
                          ) : null}
                        </Toggle>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    disabled={busy || remainingIngredients.length === 0}
                    onClick={() => void onGenerateRecipeWithSelection()}
                    className="mt-3 w-full rounded-2xl bg-[#F28C28] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#e07d1f] disabled:opacity-50"
                  >
                    {t.chef.generateRecipe}
                  </button>
                  {selectionInfo ? (
                    <p className="mt-2 text-xs text-neutral-600">{selectionInfo}</p>
                  ) : null}
                </div>
              )}
            </div>

            <form onSubmit={onSubmit} className="border-t border-neutral-100 p-2.5 sm:p-3">
              <div className="flex gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
                  rows={2}
                  placeholder={t.chef.placeholder}
                  className="min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#2D5A27]/25"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="min-h-11 shrink-0 self-end rounded-2xl bg-[#F28C28] px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-[#e07d1f] disabled:opacity-50 sm:px-5"
                >
                  {t.chef.send}
                </button>
              </div>
            </form>
          </div>

          {(cookPlan.length > 0 || plan) && (
            <div className="rounded-3xl border border-[#F28C28]/35 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-[#2D5A27]">{recipeTitle}</h2>
              <p className="mt-1 text-xs text-neutral-500">{t.chef.recipeReady}</p>
              <ul className="mt-4 space-y-2 text-sm">
                {cookPlan.map((it, idx) => (
                  <li key={`${it.itemName}-${it.unit}-${idx}`} className="flex justify-between rounded-xl bg-[#faf8f5] px-3 py-2">
                    <span>{it.itemName}</span>
                    <span className="tabular-nums text-neutral-600">−{it.amountToSubtract} {it.unit}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={cookLoading}
                onClick={() => void onCook()}
                className="mt-6 min-h-11 w-full rounded-full bg-[#2D5A27] py-3 text-sm font-semibold text-white transition hover:bg-[#234822] disabled:opacity-50"
              >
                {cookLoading ? t.chef.cooking : t.chef.cookBtn}
              </button>
              {cookMsg && <p className="mt-3 text-sm text-neutral-700" role="status">{cookMsg}</p>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
