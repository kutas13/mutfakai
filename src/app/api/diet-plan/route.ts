import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/admin";

function getOpenAIModel() {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) return null;
  const openai = createOpenAI({ apiKey: key });
  return openai("gpt-4o-mini");
}

type DietMode = "pantry" | "dietitian";
type FrequencyMode = "single" | "weekly" | "monthly";

type DietPayload = {
  height: number;
  weight: number;
  age: number;
  gender: "female" | "male";
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active";
  goal: "kilo_verme" | "kas" | "koruma";
  lang?: "tr" | "en";
  mode?: DietMode;
  frequency?: FrequencyMode;
  budgetMonthlyTl?: number;
  regenerate?: boolean;
};

type SinglePlan = { type: "single"; planText: string; intro?: string; budgetSummary?: string };
type MultiPlan = {
  type: "multi";
  intro: string;
  budgetSummary: string;
  weeks: { label: string; days: { dayName: string; content: string }[] }[];
};
type PlanResponse = SinglePlan | MultiPlan;

function jsonResponse(payload: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
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

const trDayNames = [
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
  "Pazar",
];
const enDayNames = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const MultiPlanSchema = z.object({
  intro: z
    .string()
    .describe("BMR, TDEE, hedef kalori ve makro özetini düz, sade dille anlat."),
  budgetSummary: z
    .string()
    .describe(
      "Aylık bütçenin plana nasıl yansıdığını 2-3 cümleyle özetle. Bütçe yoksa 'Bütçe sınırı belirtilmedi' yaz.",
    ),
  weeks: z
    .array(
      z.object({
        label: z.string().describe("Hafta başlığı, ör: '1. Hafta' / 'Week 1'"),
        days: z
          .array(
            z.object({
              dayName: z
                .string()
                .describe("Gün adı (Pazartesi, Salı vb. ya da Monday, Tuesday)"),
              content: z
                .string()
                .describe(
                  "O güne ait Kahvaltı, Ara Öğün, Öğle, Ara Öğün, Akşam başlıkları altında porsiyon ve gramaj içeren açık liste. Düz metin, satır satır, başlıklar büyük harfle veya iki nokta ile.",
                ),
            }),
          )
          .min(7)
          .max(7),
      }),
    )
    .min(1)
    .max(4),
});

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
    return jsonResponse(
      { error: "Bu özellik sadece Premium üyeler içindir." },
      { status: 403 },
    );
  }

  let body: Partial<DietPayload>;
  try {
    body = (await request.json()) as Partial<DietPayload>;
  } catch {
    return jsonResponse({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  const height = Number(body.height);
  const weight = Number(body.weight);
  const age = Number(body.age);
  const gender = body.gender;
  const activityLevel = body.activityLevel;
  const goal = body.goal;
  const lang = body.lang === "en" ? "en" : "tr";
  const mode: DietMode = body.mode === "dietitian" ? "dietitian" : "pantry";
  const frequency: FrequencyMode =
    body.frequency === "weekly"
      ? "weekly"
      : body.frequency === "monthly"
      ? "monthly"
      : "single";
  const budgetMonthlyTl = Number.isFinite(Number(body.budgetMonthlyTl))
    ? Math.max(0, Math.floor(Number(body.budgetMonthlyTl)))
    : 0;
  const regenerate = body.regenerate === true;

  if (
    Number.isNaN(height) ||
    Number.isNaN(weight) ||
    Number.isNaN(age) ||
    !gender ||
    !activityLevel ||
    !goal
  ) {
    return jsonResponse({ error: "Eksik veya hatalı alanlar var." }, { status: 400 });
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
    mode,
    frequency,
    budgetMonthlyTl,
    regenerate,
  });

  if (!regenerate) {
    const { data: latestSaved } = await supabase
      .from("admin_audit_logs")
      .select("payload, created_at")
      .eq("user_id", user.id)
      .eq("event_type", "diet_plan_saved")
      .order("created_at", { ascending: false })
      .limit(40);

    const saved = (latestSaved ?? []).find((row) => {
      const p = row.payload as { mode?: string; frequency?: string } | null;
      return p?.mode === mode && p?.frequency === frequency;
    });
    const savedJson = (saved?.payload as { planJson?: PlanResponse } | null)?.planJson;
    if (savedJson) {
      console.log("[diet-plan] returning saved plan", {
        userId: user.id,
        mode,
        frequency,
        createdAt: saved?.created_at,
      });
      return jsonResponse(savedJson);
    }
  }

  const model = getOpenAIModel();
  if (!model) {
    return jsonResponse({ error: "OPENAI_API_KEY eksik." }, { status: 503 });
  }

  let pantryContextLine = "";
  let frequentIngredients: string[] = [];

  if (mode === "pantry") {
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

    frequentIngredients = [...usageCount.values()]
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
          ? "Dolabında henüz ürün görünmüyor. Dolaba göre plan oluşturabilmem için önce dolabına birkaç ürün ekle (ör. yumurta, yoğurt, tavuk, pirinç, sebze) ya da 'Diyetisyen tavsiyesine göre' seçeneğini kullan."
          : "Your pantry is currently empty. To build a pantry-based plan, please add a few items first (e.g. eggs, yogurt, chicken, rice, vegetables) — or use the 'Dietitian guidance' option instead.";

      const fallback: SinglePlan = { type: "single", planText: emptyMsg };
      await supabase.from("admin_audit_logs").insert({
        user_id: user.id,
        event_type: "diet_plan_saved",
        payload: {
          planJson: fallback,
          mode,
          frequency,
          generatedFrom: "empty_pantry_message",
          lang,
        },
      });
      return jsonResponse(fallback);
    }

    if (lang === "tr") {
      pantryContextLine =
        frequentIngredients.length > 0
          ? `Kullanıcının dolabında geçmişte en az 3 kez eklediği ve halen bulunan sık ürünler: ${frequentIngredients.join(", ")}. Öğünlerin merkezini bu ürünler oluşturmalı.`
          : "Kullanıcının dolabında 3+ kez eklenen net bir ürün yok; yine de dolaptaki mevcut temel ürünlere yakın bir plan yaz.";
    } else {
      pantryContextLine =
        frequentIngredients.length > 0
          ? `Frequent pantry items (added 3+ times historically and still present): ${frequentIngredients.join(", ")}. Build the meals around these items.`
          : "No clear 3+ historical items; still create a practical plan close to currently available pantry basics.";
    }
  } else {
    pantryContextLine =
      lang === "tr"
        ? "Bu plan dolaptan bağımsız, profesyonel bir diyetisyenin önereceği dengeli ve çeşitli yemekler içermeli."
        : "This plan should be independent of pantry; balanced and varied like a professional dietitian's prescription.";
  }

  const budgetLineTr =
    budgetMonthlyTl > 0
      ? `Kullanıcının aylık gıda bütçesi yaklaşık ${budgetMonthlyTl} ₺. Bu bütçeyi aşmayacak, mevsimine ve fiyatına uygun ekonomik gıdalar seç.`
      : "Bütçe sınırı belirtilmedi.";
  const budgetLineEn =
    budgetMonthlyTl > 0
      ? `User's approximate monthly food budget: ${budgetMonthlyTl} TL. Choose economical, seasonal foods that fit this budget.`
      : "No specific budget cap.";

  const userBlockTr = `Kullanıcı Bilgileri:
- Boy: ${height} cm
- Kilo: ${weight} kg
- Yaş: ${age}
- Cinsiyet: ${gender === "female" ? "Kadın" : "Erkek"}
- Aktivite Seviyesi: ${normalizeActivity(activityLevel, "tr")}
- Hedef: ${goal}
${pantryContextLine}
${budgetLineTr}`;

  const userBlockEn = `User Profile:
- Height: ${height} cm
- Weight: ${weight} kg
- Age: ${age}
- Gender: ${gender}
- Activity Level: ${normalizeActivity(activityLevel, "en")}
- Goal: ${goal}
${pantryContextLine}
${budgetLineEn}`;

  if (frequency === "single") {
    const trPrompt = `${userBlockTr}

Bu verilere göre tek bir günlük diyet planı kur:
1) BMR ve TDEE özeti (kısa).
2) Hedefe göre günlük kalori aralığı.
3) Tek bir günlük plan (Kahvaltı, Ara Öğün, Öğle, Ara Öğün, Akşam) — porsiyon ve gramajla.
4) Makro hedefleri (protein/karb/yağ) gram olarak.
5) Bütçe varsa uyumluluğu kısa not olarak ekle.

Kurallar:
- ASLA LaTeX, '#', '**', '\\[' kullanma.
- Açık, başlıklı düz metin yaz.
- Liste oldukça anlaşılır olsun, net porsiyon ve gramaj kullan.`;

    const enPrompt = `${userBlockEn}

Build a single daily plan:
1) Short BMR and TDEE summary.
2) Target daily calorie range.
3) One day plan (Breakfast, Snack, Lunch, Snack, Dinner) — portions and grams.
4) Macro targets (protein/carbs/fat) in grams.
5) If budget given, brief compatibility note.

Rules:
- Never use LaTeX, '#', '**', '\\['.
- Plain text with clear headings.
- The list must be very easy to follow, with explicit portions and grams.`;

    const result = await generateText({
      model,
      prompt: lang === "en" ? enPrompt : trPrompt,
      temperature: mode === "dietitian" ? 0.5 : 0.4,
    });

    const plan: SinglePlan = {
      type: "single",
      planText: result.text
        .replace(/\\\[/g, "")
        .replace(/\\\]/g, "")
        .replace(/\*\*/g, "")
        .replace(/^#\s*/gm, "")
        .trim(),
    };

    await supabase.from("admin_audit_logs").insert({
      user_id: user.id,
      event_type: "diet_plan_saved",
      payload: {
        planJson: plan,
        input: { height, weight, age, gender, activityLevel, goal, lang },
        frequentIngredients,
        mode,
        frequency,
        budgetMonthlyTl,
        generatedFrom: "ai",
      },
    });

    return jsonResponse(plan);
  }

  const weekCount = frequency === "monthly" ? 4 : 1;
  const dayNames = lang === "tr" ? trDayNames : enDayNames;
  const weekLabelHint =
    lang === "tr"
      ? `Hafta etiketleri: ${Array.from({ length: weekCount }, (_, i) => `${i + 1}. Hafta`).join(", ")}.`
      : `Week labels: ${Array.from({ length: weekCount }, (_, i) => `Week ${i + 1}`).join(", ")}.`;

  const trMultiPrompt = `${userBlockTr}

Çıktı: ${weekCount} hafta × 7 gün, her gün için Kahvaltı, Ara Öğün, Öğle, Ara Öğün, Akşam başlıkları ile yapılandırılmış JSON. Aynı JSON şemasına sıkı sıkıya uy.

${weekLabelHint}
Gün adlarını sırayla şu şekilde kullan: ${dayNames.join(", ")}.

Kurallar:
- 'content' alanı her gün için düz metin olarak şu yapıyı izlesin:
  KAHVALTI:
  - …
  ARA ÖĞÜN:
  - …
  ÖĞLE:
  - …
  ARA ÖĞÜN:
  - …
  AKŞAM:
  - …
  GÜNLÜK TOPLAM: ~kalori, protein/karb/yağ
- Porsiyon ve gramaj net olsun.
- Günler arasında çeşitlilik olsun, aynı yemekleri tekrar etme.
- Bütçe verildiyse ekonomik ve mevsimine uygun seçimler yap.
- 'budgetSummary' alanına 2-3 cümlelik bütçe açıklaması yaz; bütçe yoksa 'Bütçe sınırı belirtilmedi'.
- 'intro' alanı BMR/TDEE/kalori/makro özet içersin.
- LaTeX, '\\[', '#', '**' kullanma.`;

  const enMultiPrompt = `${userBlockEn}

Output: ${weekCount} weeks × 7 days. Each day has Breakfast, Snack, Lunch, Snack, Dinner sections. Strictly follow the JSON schema.

${weekLabelHint}
Use day names in this order: ${dayNames.join(", ")}.

Rules:
- 'content' for each day must follow this plain text structure:
  BREAKFAST:
  - …
  SNACK:
  - …
  LUNCH:
  - …
  SNACK:
  - …
  DINNER:
  - …
  DAILY TOTAL: ~kcal, protein/carbs/fat
- Use explicit portions and grams.
- Vary meals across days; do not repeat.
- If budget is given, choose economical, seasonal foods.
- 'budgetSummary' should be 2-3 sentences. If no budget, write 'No budget cap specified'.
- 'intro' should summarise BMR/TDEE/calories/macros.
- Do not use LaTeX, '\\[', '#', '**'.`;

  let multi: MultiPlan;
  try {
    const result = await generateObject({
      model,
      schema: MultiPlanSchema,
      prompt: lang === "en" ? enMultiPrompt : trMultiPrompt,
      temperature: mode === "dietitian" ? 0.6 : 0.5,
    });
    const obj = result.object;
    const trimmedWeeks = obj.weeks.slice(0, weekCount).map((w, idx) => ({
      label: w.label?.trim() || (lang === "tr" ? `${idx + 1}. Hafta` : `Week ${idx + 1}`),
      days: w.days.slice(0, 7).map((d, dayIdx) => ({
        dayName: d.dayName?.trim() || dayNames[dayIdx] || `Day ${dayIdx + 1}`,
        content: d.content
          .replace(/\\\[/g, "")
          .replace(/\\\]/g, "")
          .replace(/\*\*/g, "")
          .replace(/^#\s*/gm, "")
          .trim(),
      })),
    }));

    while (trimmedWeeks.length < weekCount) {
      trimmedWeeks.push({
        label: lang === "tr" ? `${trimmedWeeks.length + 1}. Hafta` : `Week ${trimmedWeeks.length + 1}`,
        days: dayNames.map((dn) => ({ dayName: dn, content: "" })),
      });
    }

    multi = {
      type: "multi",
      intro: obj.intro
        .replace(/\\\[/g, "")
        .replace(/\\\]/g, "")
        .replace(/\*\*/g, "")
        .trim(),
      budgetSummary: obj.budgetSummary.trim(),
      weeks: trimmedWeeks,
    };
  } catch (err) {
    console.log("[diet-plan] generateObject error", err);
    return jsonResponse(
      { error: "Plan oluşturulurken bir hata oluştu, lütfen tekrar deneyin." },
      { status: 500 },
    );
  }

  await supabase.from("admin_audit_logs").insert({
    user_id: user.id,
    event_type: "diet_plan_saved",
    payload: {
      planJson: multi,
      input: { height, weight, age, gender, activityLevel, goal, lang },
      frequentIngredients,
      mode,
      frequency,
      budgetMonthlyTl,
      generatedFrom: "ai",
    },
  });

  return jsonResponse(multi);
}
