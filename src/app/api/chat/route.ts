import { createOpenAI } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { getChefSystemPrompt } from "@/lib/chef/prompt";
import {
  formatInventoryForPrompt,
  getInventory,
} from "@/lib/inventory/getInventory";
import { createClient } from "@/lib/supabase/server";
import type { Lang } from "@/lib/i18n/dictionaries";

const inventoryContextSection = (block: string) =>
  `\n\n## Güncel envanter (her mesajda güncel)\n${block}\n`;

function getOpenAIModel() {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) return null;
  const openai = createOpenAI({ apiKey: key });
  return openai("gpt-4o");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const model = getOpenAIModel();
  if (!model) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY eksik — .env.local içine anahtarını ekle." }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: { messages?: unknown[]; lang?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Geçersiz istek gövdesi" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const lang: Lang = body.lang === "en" ? "en" : "tr";
  const uiMessages = (body.messages ?? []) as Parameters<typeof convertToModelMessages>[0];

  let inventoryBlock: string;
  try {
    const rows = await getInventory();
    inventoryBlock = formatInventoryForPrompt(rows);
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Envanter okunamadı" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const meta = user.user_metadata as { first_name?: string; last_name?: string } | undefined;
  const userName = [meta?.first_name, meta?.last_name].filter(Boolean).join(" ");
  const hitap = userName
    ? `Kullanıcının adı: ${userName}. Her mesajda ismiyle hitap et.`
    : "Kullanıcı adını bilmiyorsan 'Şefim' diye hitap et.";

  const tools = {
    malzemeSecimListesi: tool({
      description:
        "Kullanıcı yemek ve kişi sayısını verdikten sonra, tarifteki tüm malzemeleri seçim ekranı için çıkar. Ana malzemeler isCore=true olmalı.",
      inputSchema: z.object({
        recipeTitle: z.string(),
        servings: z.number().int().positive(),
        items: z
          .array(
            z.object({
              name: z.string(),
              isCore: z.boolean(),
              category: z.enum(["main", "side"]),
            }),
          )
          .min(1),
      }),
      execute: async (input) => {
        await supabase.from("admin_audit_logs").insert({
          user_id: user.id,
          event_type: "ingredient_selection_generated",
          payload: input,
        });
        return input;
      },
    }),
    kaydetTarifStoku: tool({
      description:
        "Tarif netleştiğinde, mutfaktan düşülecek her malzeme için miktar ve birimi bu araçla kaydet. Kullanıcı 'Yemeği Pişir' ile onaylayacak.",
      inputSchema: z.object({
        recipeTitle: z.string().describe("Tarifin kısa adı"),
        items: z
          .array(
            z.object({
              itemName: z.string().describe("Envanterdeki madde adına yakın ifade"),
              amountToSubtract: z
                .number()
                .positive()
                .describe("Düşülecek miktar (temel birimde: gr, ml veya adet)"),
              unit: z.enum(["gr", "ml", "adet"]),
            }),
          )
          .min(1),
      }),
      execute: async (input) => {
        await supabase.from("admin_audit_logs").insert({
          user_id: user.id,
          event_type: "recipe_plan_created",
          payload: input,
        });
        return input;
      },
    }),
  };

  const modelMessages = await convertToModelMessages(uiMessages as UIMessage[], {
    tools,
    ignoreIncompleteToolCalls: true,
  });

  const result = streamText({
    model,
    system: `${getChefSystemPrompt(lang)}\n\n${hitap}${inventoryContextSection(inventoryBlock)}`,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(12),
  });

  return result.toUIMessageStreamResponse();
}
