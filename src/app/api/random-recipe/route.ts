import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { createClient } from "@/lib/supabase/server";

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
      JSON.stringify({ error: "OPENAI_API_KEY missing" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: {
    dishName?: unknown;
    servings?: unknown;
    ingredients?: unknown;
    lang?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const dishName =
    typeof body.dishName === "string" && body.dishName.trim().length > 0
      ? body.dishName.trim()
      : null;
  const servings =
    typeof body.servings === "number" && Number.isFinite(body.servings)
      ? Math.max(1, Math.floor(body.servings))
      : null;
  const ingredients = Array.isArray(body.ingredients)
    ? (body.ingredients as unknown[]).filter(
        (x): x is string => typeof x === "string" && x.trim().length > 0,
      )
    : [];
  const lang: "tr" | "en" = body.lang === "en" ? "en" : "tr";

  if (!dishName || !servings) {
    return new Response(
      JSON.stringify({ error: "dishName and servings are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const meta = user.user_metadata as
    | { first_name?: string; last_name?: string }
    | undefined;
  const userName = [meta?.first_name, meta?.last_name].filter(Boolean).join(" ");

  const isTr = lang === "tr";

  const hitap = userName
    ? isTr
      ? `Kullanıcının adı ${userName}. Tarife başlarken bir defa kibarca ismiyle hitap et.`
      : `The user's name is ${userName}. Greet them by name once at the start.`
    : isTr
      ? "Kullanıcıya 'Şefim' diye hitap edebilirsin."
      : "You may address the user as 'Chef'.";

  const system = isTr
    ? `Sen MutfakAI Başşefisin. Profesyonel, detaylı ve kişi sayısına göre ölçeklendirilmiş tarifler yazarsın.

Tarif yapısı (markdown başlıklarla):
1) Kısa giriş (1-2 cümle, lezzetin karakterini anlat).
2) ## Malzemeler — listede her satır pratik birimle, parantezde teknik miktar olacak. Örn: "2 Yemek Kaşığı Zeytinyağı (30 ml)", "300 gr Tavuk Göğsü (300 gr)".
3) ## Hazırlık (Mise en Place) — soğanı brunoise doğra, sarımsağı ezerek aroma çıkar gibi profesyonel detaylar.
4) ## Yemeğin Yapımı — adım adım, görsel/duyusal ipuçlarla (örn: "soğanlar pembeleşene kadar 5 dk").
5) ## Şefin Püf Noktası — 1-2 maddelik gerçekten faydalı tüyolar.
6) ## Servis — sıcaklık, eşlik edebilecek şeyler.

Önemli kurallar:
- Tüm malzeme miktarlarını verilen kişi sayısına göre ölçekle.
- Domates kullanılan sulu/soslu yemeklerde "domateslerin kabuğunu soyduktan sonra küp küp doğra" detayını ekle.
- Sote/kavurma adımlarını teknik olarak açıklarken nedenini de söyle ("yüksek ateşte mühürle, suyu içine hapsolur").
- Sadece tarifle sınırlı kal — ayrıca soru sorma, başka adım önerme.

${hitap}`
    : `You are MutfakAI Head Chef. Write professional, detailed recipes scaled to the requested servings.

Recipe structure (markdown headings):
1) Short intro (1-2 sentences about the flavor character).
2) ## Ingredients — each line uses practical units with technical amount in parentheses. e.g. "2 Tablespoons Olive Oil (30 ml)", "300 g Chicken Breast (300 gr)".
3) ## Mise en Place — pro details (brunoise the onion, crush the garlic for aroma, etc.).
4) ## Cooking — step-by-step with sensory cues (e.g. "until onions turn translucent, ~5 min").
5) ## Chef's Pro Tip — 1-2 truly useful tips.
6) ## Serving — temperature, accompaniments.

Important rules:
- Scale all ingredient quantities to the given servings.
- For tomato-based dishes, include "peel tomatoes first, then dice".
- When explaining searing/sautéing, also state the reason ("sear on high heat to lock in juices").
- Stay strictly within the recipe — do not ask questions or propose extra steps.

${hitap}`;

  const userPrompt = isTr
    ? `Yemek: ${dishName}
Kişi sayısı: ${servings}
Mutfağımdaki malzemeler: ${ingredients.length ? ingredients.join(", ") : "(seçim yapılmadı, makul varsayımlar yap)"}

Lütfen yukarıdaki yapıya uygun, eksiksiz ve profesyonel tarifi yaz.`
    : `Dish: ${dishName}
Servings: ${servings}
Pantry: ${ingredients.length ? ingredients.join(", ") : "(none selected — use reasonable defaults)"}

Please write the complete, professional recipe following the structure above.`;

  await supabase.from("admin_audit_logs").insert({
    user_id: user.id,
    event_type: "random_recipe_requested",
    payload: { dishName, servings, ingredients, lang },
  });

  const result = streamText({
    model,
    system,
    prompt: userPrompt,
  });

  return result.toTextStreamResponse();
}
