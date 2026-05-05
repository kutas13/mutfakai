import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
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

  const model = getOpenAIModel();
  if (!model) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY eksik." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const trPrompt = `Kullanıcı Bilgileri:
- Boy: ${height} cm
- Kilo: ${weight} kg
- Yaş: ${age}
- Cinsiyet: ${gender === "female" ? "Kadın" : "Erkek"}
- Aktivite Seviyesi: ${activityLevel}
- Hedef: ${goal}

Bu verilere göre:
1) BMR (Mifflin-St Jeor) hesapla.
2) Aktivite katsayısı ile TDEE hesapla.
3) Hedefe göre günlük kalori aralığı ver.
4) 1 günlük örnek diyet planı oluştur (kahvaltı, öğle, ara öğün, akşam).
5) Makro dağılımını (protein/karb/yağ) yaklaşık gram olarak ver.

Yanıtı sade ve anlaşılır Türkçe ile başlıklar halinde ver.`;

  const enPrompt = `User Profile:
- Height: ${height} cm
- Weight: ${weight} kg
- Age: ${age}
- Gender: ${gender}
- Activity Level: ${activityLevel}
- Goal: ${goal}

Please:
1) Calculate BMR (Mifflin-St Jeor).
2) Calculate TDEE using activity multiplier.
3) Provide target daily calorie range based on goal.
4) Build a 1-day sample meal plan (breakfast, lunch, snack, dinner).
5) Provide approximate macro targets in grams (protein/carbs/fat).

Write the response with clear markdown headings in English.`;

  const result = streamText({
    model,
    prompt: lang === "en" ? enPrompt : trPrompt,
    temperature: 0.4,
  });

  return result.toTextStreamResponse();
}
