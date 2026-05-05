import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const RecipeIdeasSchema = z.object({
  ideas: z
    .array(
      z.object({
        name: z.string().describe("Yemeğin adı"),
        description: z
          .string()
          .describe("Yemeği 1-2 cümle ile tanıtan kısa açıklama"),
      }),
    )
    .min(3)
    .max(5),
});

function getOpenAIModel() {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) return null;
  const openai = createOpenAI({ apiKey: key });
  return openai("gpt-4o-mini");
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
      JSON.stringify({ error: "OPENAI_API_KEY missing" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: { ingredients?: unknown; lang?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ingredients = Array.isArray(body.ingredients)
    ? (body.ingredients as unknown[]).filter(
        (x): x is string => typeof x === "string" && x.trim().length > 0,
      )
    : [];
  const lang: "tr" | "en" = body.lang === "en" ? "en" : "tr";

  if (ingredients.length === 0) {
    return new Response(
      JSON.stringify({ error: "ingredients required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const isTr = lang === "tr";

  const system = isTr
    ? `Sen MutfakAI Başşefisin. Kullanıcının elindeki malzemelerle yapılabilecek pratik, lezzetli ve birbirinden farklı yemek fikirleri önerirsin. 
- Önerilerin 4 farklı kategori/teknikten gelsin (örn: bir ana yemek, bir çorba/meze, bir hafif/salata, bir tatlı veya kahvaltılık).
- Her yemeğin adı kısa ve net olsun (örn: "Tavuk Sote", "Mercimek Çorbası").
- Açıklamalar 1-2 cümleyi geçmesin; yemeğin tarzını ve neyi öne çıkardığını anlatsın.
- Türk damak tadına uygun, kolay yapılabilen tarifler seç.
- Tuz, karabiber, su gibi temel mutfak malzemelerini ek olarak varsayabilirsin.`
    : `You are MutfakAI Head Chef. Suggest practical, tasty and varied dishes that can be made with the user's ingredients.
- Provide 4 ideas spanning different styles (e.g. one main, one soup/starter, one light/salad, one sweet or breakfast).
- Names should be short and clear (e.g. "Chicken Saute", "Lentil Soup").
- Each description must be 1-2 sentences max, highlighting the style and key flavor.
- Choose easy-to-make recipes.
- You may assume basic pantry staples (salt, pepper, water).`;

  const prompt = isTr
    ? `Mutfağımdaki malzemeler: ${ingredients.join(", ")}.

Bu malzemelerle yapılabilecek 4 farklı yemek fikri öner. Her birinin adı (Türkçe) ve 1-2 cümlelik kısa açıklaması olsun.`
    : `My pantry ingredients: ${ingredients.join(", ")}.

Suggest 4 different dishes I can make. For each, give a short name and a 1-2 sentence description.`;

  try {
    const { object } = await generateObject({
      model,
      schema: RecipeIdeasSchema,
      system,
      prompt,
    });

    await supabase.from("admin_audit_logs").insert({
      user_id: user.id,
      event_type: "random_ideas_generated",
      payload: { ingredients, lang, ideas: object.ideas },
    });

    return Response.json(object);
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Idea generation failed",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
