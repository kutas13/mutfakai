import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/admin";

function getOpenAIModel() {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) return null;
  const openai = createOpenAI({ apiKey: key });
  return openai("gpt-4o-mini");
}

type DietPayload = {
  height: number;
  weight: number;
  age: number;
  gender: "female" | "male";
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active";
  goal: "kilo_verme" | "kas" | "koruma";
  lang?: "tr" | "en";
};

function toChunkedTextResponse(text: string): Response {
  const encoder = new TextEncoder();
  let offset = 0;
  return new Response(
    new ReadableStream({
      pull(controller) {
        if (offset >= text.length) {
          controller.close();
          return;
        }
        const next = text.slice(offset, offset + 120);
        offset += 120;
        controller.enqueue(encoder.encode(next));
      },
    }),
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}

function normalizeActivity(activity: DietPayload["activityLevel"], lang: "tr" | "en") {
  const trMap: Record<DietPayload["activityLevel"], string> = {
    sedentary: "Sedanter",
    light: "Hafif aktif",
    moderate: "Orta aktif",
    active: "Aktif",
    very_active: "Çok aktif",
  };
  const enMap: Record<DietPayload["activityLevel"], string> = {
    sedentary: "Sedentary",
    light: "Lightly active",
    moderate: "Moderately active",
    active: "Active",
    very_active: "Very active",
  };
  return lang === "tr" ? trMap[activity] : enMap[activity];
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium")
    .eq("id", user.id)
    .single();

  const allow = isAdmin(user.email) || Boolean(profile?.is_premium);
  if (!allow) {
    return new Response(
      JSON.stringify({ error: "Bu özellik sadece Premium üyeler içindir." }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: Partial<DietPayload>;
  try {
    body = (await request.json()) as Partial<DietPayload>;
  } catch {
    return new Response(JSON.stringify({ error: "Geçersiz istek gövdesi" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const height = Number(body.height);
  const weight = Number(body.weight);
  const age = Number(body.age);
  const gender = body.gender;
  const activityLevel = body.activityLevel;
  const goal = body.goal;
  const lang = body.lang === "en" ? "en" : "tr";

  if (
    Number.isNaN(height) ||
    Number.isNaN(weight) ||
    Number.isNaN(age) ||
    !gender ||
    !activityLevel ||
    !goal
  ) {
    return new Response(JSON.stringify({ error: "Eksik veya hatalı alanlar var." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log("[diet-plan] request", {
    userId: user.id,
    email: user.email,
    height,
    weight,
    age,
    gender,
    activityLevel,
    goal,
    lang,
  });

  const { data: latestSaved } = await supabase
    .from("admin_audit_logs")
    .select("payload, created_at")
    .eq("user_id", user.id)
    .eq("event_type", "diet_plan_saved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const savedText =
    (latestSaved?.payload as { planText?: string } | null)?.planText ?? null;
  if (savedText) {
    console.log("[diet-plan] returning saved plan", {
      userId: user.id,
      createdAt: latestSaved?.created_at,
    });
    return toChunkedTextResponse(savedText);
  }

  const { data: stocks } = await supabase
    .from("stocks")
    .select("item_name, quantity")
    .eq("user_id", user.id)
    .order("quantity", { ascending: false })
    .limit(200);

  const { data: stockAddHistory } = await supabase
    .from("admin_audit_logs")
    .select("payload")
    .eq("user_id", user.id)
    .eq("event_type", "stock_add")
    .order("created_at", { ascending: false })
    .limit(1000);

  const currentStockNames = new Set(
    (stocks ?? []).map((s) => String(s.item_name).trim().toLowerCase()),
  );
  const usageCount = new Map<string, { name: string; count: number }>();
  for (const row of stockAddHistory ?? []) {
    const payload = row.payload as { item_name?: string } | null;
    const rawName = payload?.item_name?.trim();
    if (!rawName) continue;
    const key = rawName.toLowerCase();
    const prev = usageCount.get(key);
    usageCount.set(key, { name: rawName, count: (prev?.count ?? 0) + 1 });
  }

  const frequentIngredients = [...usageCount.values()]
    .filter((x) => x.count >= 3)
    .filter((x) => currentStockNames.has(x.name.toLowerCase()))
    .sort((a, b) => b.count - a.count)
    .map((x) => x.name)
    .slice(0, 12);

  const hasAnyPantryData =
    (stocks?.length ?? 0) > 0 || (stockAddHistory?.length ?? 0) > 0;
  if (!hasAnyPantryData) {
    const emptyMsg =
      lang === "tr"
        ? "Dolabında henüz ürün görünmüyor. Diyet planını daha kişisel yapabilmem için önce dolabına birkaç ürün ekle (ör. yumurta, yoğurt, tavuk, pirinç, sebze). Ürünleri ekledikten sonra tekrar 'Hesapla' dediğinde dolabına göre bir plan oluşturacağım."
        : "Your pantry is currently empty. To generate a personalized diet plan, please add some ingredients first (e.g. eggs, yogurt, chicken, rice, vegetables). Then press Calculate again and I will build a pantry-based plan.";

    await supabase.from("admin_audit_logs").insert({
      user_id: user.id,
      event_type: "diet_plan_saved",
      payload: {
        planText: emptyMsg,
        generatedFrom: "empty_pantry_message",
        lang,
      },
    });

    return toChunkedTextResponse(emptyMsg);
  }

  const model = getOpenAIModel();
  if (!model) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY eksik." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const pantryLineTr =
    frequentIngredients.length > 0
      ? `Kullanıcının dolabında geçmişte en az 3 kez eklediği ve halen bulunan sık ürünler: ${frequentIngredients.join(", ")}`
      : "Kullanıcının dolabında 3+ kez eklenen net bir ürün yok; yine de dolaptaki mevcut temel ürünlere yakın bir plan yaz.";

  const trPrompt = `Kullanıcı Bilgileri:
- Boy: ${height} cm
- Kilo: ${weight} kg
- Yaş: ${age}
- Cinsiyet: ${gender === "female" ? "Kadın" : "Erkek"}
- Aktivite Seviyesi: ${normalizeActivity(activityLevel, "tr")}
- Hedef: ${goal}
${pantryLineTr}

Bu verilere göre:
1) BMR ve TDEE hesaplamasını kısa ve anlaşılır olarak ver.
2) Hedefe göre günlük kalori aralığı ver.
4) 1 günlük örnek diyet planı oluştur (kahvaltı, öğle, ara öğün, akşam).
5) Makro dağılımını (protein/karb/yağ) yaklaşık gram olarak yaz.

Kurallar:
- Önceliği dolaptaki sık ürünlere ver.
- ASLA LaTeX, matematik blokları, '\\[', '\\]', '\\times', '#', '**' kullanma.
- Yanıtı düz metin ve sade başlıklarla ver.`;

  const pantryLineEn =
    frequentIngredients.length > 0
      ? `Frequent pantry items (added 3+ times historically and still present): ${frequentIngredients.join(", ")}`
      : "No clear 3+ historical items; still create a practical plan close to currently available pantry basics.";
  const enPrompt = `User Profile:
- Height: ${height} cm
- Weight: ${weight} kg
- Age: ${age}
- Gender: ${gender}
- Activity Level: ${normalizeActivity(activityLevel, "en")}
- Goal: ${goal}
${pantryLineEn}

Please:
1) Give short, easy-to-read BMR and TDEE summary.
3) Provide target daily calorie range based on goal.
4) Build a 1-day sample meal plan (breakfast, lunch, snack, dinner).
5) Provide approximate macro targets in grams (protein/carbs/fat).

Rules:
- Prioritize frequent pantry items.
- Do NOT output LaTeX, math blocks, '\\[', '\\]', '\\times', '#', '**'.
- Keep output plain text with simple section titles.`;

  const result = await generateText({
    model,
    prompt: lang === "en" ? enPrompt : trPrompt,
    temperature: 0.4,
  });

  const planText = result.text.trim();
  await supabase.from("admin_audit_logs").insert({
    user_id: user.id,
    event_type: "diet_plan_saved",
    payload: {
      planText,
      input: { height, weight, age, gender, activityLevel, goal, lang },
      frequentIngredients,
      generatedFrom: "ai",
    },
  });

  return toChunkedTextResponse(planText);
}
