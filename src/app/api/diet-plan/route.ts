import { createOpenAI } from "@ai-sdk/openai";
import { streamObject, streamText } from "ai";
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
type DietStyle = "standard" | "keto" | "omad";

type DietPayload = {
  height: number;
  weight: number;
  targetWeight?: number;
  age: number;
  gender: "female" | "male";
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active";
  goal: "kilo_verme" | "kas" | "koruma" | "kalori_acigi";
  lang?: "tr" | "en";
  mode?: DietMode;
  frequency?: FrequencyMode;
  dietStyle?: DietStyle;
  budgetMonthlyTl?: number;
  targetKcal?: number;
  regenerate?: boolean;
};

type SinglePlan = { type: "single"; planText: string; exercise: string };
type MultiPlan = {
  type: "multi";
  intro: string;
  budgetSummary: string;
  exercise: string;
  weeks: { label: string; days: { dayName: string; content: string }[] }[];
};
type PlanResponse = SinglePlan | MultiPlan;

function jsonResponse(payload: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

function ndjsonHeaders(): HeadersInit {
  return {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  };
}

function ndjsonOnce(plan: PlanResponse): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(JSON.stringify(plan) + "\n"));
        controller.close();
      },
    }),
    { headers: ndjsonHeaders() },
  );
}

function cleanInline(text: string): string {
  return text
    .replace(/\\\[/g, "")
    .replace(/\\\]/g, "")
    .replace(/\\times/g, "x")
    .replace(/\\approx/g, "~")
    .replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/^#\s*/gm, "");
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

const trDayNames = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const enDayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const MultiPlanSchema = z.object({
  intro: z
    .string()
    .describe("BMR, TDEE, hedef kalori, makro özetini ve hedef kiloya ulaşma stratejisini 4-6 cümleyle anlat."),
  budgetSummary: z
    .string()
    .describe(
      "Aylık bütçenin plana nasıl yansıdığını 2-3 cümleyle özetle. Bütçe yoksa 'Bütçe sınırı belirtilmedi' yaz.",
    ),
  exercise: z
    .string()
    .describe(
      "Profesyonel bir diyetisyenin önereceği haftalık egzersiz/kardiyo programı. Hedef ve aktivite seviyesine göre kişiselleştirilmiş; günlük yürüyüş/koşu/HIIT/güç antrenmanı önerileri, dakika ve sıklık ile.",
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
                  "O güne ait Kahvaltı, Ara Öğün, Öğle, Ara Öğün, Akşam başlıkları altında porsiyon ve gramaj içeren açık liste. Düz metin, satır satır.",
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

type MultiPartial = Partial<{
  intro: string;
  budgetSummary: string;
  exercise: string;
  weeks: Array<
    Partial<{
      label: string;
      days: Array<Partial<{ dayName: string; content: string }>>;
    }>
  >;
}>;

function normalizeMulti(
  obj: MultiPartial,
  weekCount: number,
  lang: "tr" | "en",
): MultiPlan {
  const dayNames = lang === "tr" ? trDayNames : enDayNames;
  const weeks: MultiPlan["weeks"] = [];
  const rawWeeks = obj.weeks ?? [];
  for (let i = 0; i < weekCount; i++) {
    const w = rawWeeks[i];
    const fallbackLabel = lang === "tr" ? `${i + 1}. Hafta` : `Week ${i + 1}`;
    const label = (w?.label ?? "").trim() || fallbackLabel;
    const days: MultiPlan["weeks"][number]["days"] = [];
    for (let d = 0; d < 7; d++) {
      const dayObj = w?.days?.[d];
      days.push({
        dayName: (dayObj?.dayName ?? "").trim() || dayNames[d],
        content: cleanInline(dayObj?.content ?? "").trim(),
      });
    }
    weeks.push({ label, days });
  }
  return {
    type: "multi",
    intro: cleanInline(obj.intro ?? "").trim(),
    budgetSummary: cleanInline(obj.budgetSummary ?? "").trim(),
    exercise: cleanInline(obj.exercise ?? "").trim(),
    weeks,
  };
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
    return jsonResponse({ error: "Bu özellik sadece Premium üyeler içindir." }, { status: 403 });
  }

  let body: Partial<DietPayload>;
  try {
    body = (await request.json()) as Partial<DietPayload>;
  } catch {
    return jsonResponse({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  const height = Number(body.height);
  const weight = Number(body.weight);
  const targetWeight = Number.isFinite(Number(body.targetWeight))
    ? Math.max(0, Number(body.targetWeight))
    : 0;
  const age = Number(body.age);
  const gender = body.gender;
  const activityLevel = body.activityLevel;
  const goal = body.goal;
  const lang = body.lang === "en" ? "en" : "tr";
  const mode: DietMode = body.mode === "dietitian" ? "dietitian" : "pantry";
  const frequency: FrequencyMode =
    body.frequency === "weekly" ? "weekly" : body.frequency === "monthly" ? "monthly" : "single";
  const dietStyle: DietStyle =
    body.dietStyle === "keto" ? "keto" : body.dietStyle === "omad" ? "omad" : "standard";
  const budgetMonthlyTl = Number.isFinite(Number(body.budgetMonthlyTl))
    ? Math.max(0, Math.floor(Number(body.budgetMonthlyTl)))
    : 0;
  const targetKcal = Number.isFinite(Number(body.targetKcal))
    ? Math.max(0, Math.floor(Number(body.targetKcal)))
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
      const p = row.payload as
        | {
            mode?: string;
            frequency?: string;
            goal?: string;
            targetKcal?: number;
            budgetMonthlyTl?: number;
            targetWeight?: number;
            dietStyle?: string;
          }
        | null;
      return (
        p?.mode === mode &&
        p?.frequency === frequency &&
        (p?.goal ?? "") === goal &&
        (p?.targetKcal ?? 0) === targetKcal &&
        (p?.budgetMonthlyTl ?? 0) === budgetMonthlyTl &&
        (p?.targetWeight ?? 0) === targetWeight &&
        (p?.dietStyle ?? "standard") === dietStyle
      );
    });
    const savedJson = (saved?.payload as { planJson?: PlanResponse } | null)?.planJson;
    if (savedJson) {
      console.log("[diet-plan] returning saved plan", {
        userId: user.id,
        mode,
        frequency,
        createdAt: saved?.created_at,
      });
      return ndjsonOnce(savedJson);
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

    const hasAnyPantryData = (stocks?.length ?? 0) > 0 || (stockAddHistory?.length ?? 0) > 0;
    if (!hasAnyPantryData) {
      const emptyMsg =
        lang === "tr"
          ? "Dolabında henüz ürün görünmüyor. Dolaba göre plan oluşturabilmem için önce dolabına birkaç ürün ekle (ör. yumurta, yoğurt, tavuk, pirinç, sebze) ya da 'Diyetisyen tavsiyesine göre' seçeneğini kullan."
          : "Your pantry is currently empty. To build a pantry-based plan, please add a few items first (e.g. eggs, yogurt, chicken, rice, vegetables) — or use the 'Dietitian guidance' option instead.";

      const fallback: SinglePlan = { type: "single", planText: emptyMsg, exercise: "" };
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
      return ndjsonOnce(fallback);
    }

    pantryContextLine =
      lang === "tr"
        ? frequentIngredients.length > 0
          ? `Kullanıcının dolabında geçmişte en az 3 kez eklediği ve halen bulunan sık ürünler: ${frequentIngredients.join(", ")}. Öğünlerin merkezini bu ürünler oluşturmalı.`
          : "Kullanıcının dolabında 3+ kez eklenen net bir ürün yok; yine de dolaptaki mevcut temel ürünlere yakın bir plan yaz."
        : frequentIngredients.length > 0
          ? `Frequent pantry items (added 3+ times historically and still present): ${frequentIngredients.join(", ")}. Build the meals around these items.`
          : "No clear 3+ historical items; still create a practical plan close to currently available pantry basics.";
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

  const goalLabelTr: Record<DietPayload["goal"], string> = {
    kilo_verme: "Kilo verme",
    kalori_acigi: "Kalori açığı (zayıflama)",
    kas: "Kas kazanma",
    koruma: "Kilo koruma",
  };
  const goalLabelEn: Record<DietPayload["goal"], string> = {
    kilo_verme: "Weight loss",
    kalori_acigi: "Calorie deficit (lean down)",
    kas: "Muscle gain",
    koruma: "Maintain weight",
  };

  const isDeficit = goal === "kalori_acigi";
  const targetKcalLineTr = isDeficit
    ? targetKcal > 0
      ? `Kullanıcı 'Kalori açığı' modunda ve günlük TAVAN ${targetKcal} kcal istiyor. Plandaki günlük toplam ASLA bu sayıyı aşmasın. Her güne ait 'GÜNLÜK TOPLAM' satırı ${targetKcal} kcal'in altında olsun ve net bir kalori açığı oluştursun.`
      : "Kullanıcı 'Kalori açığı' modunda. TDEE'nin %15-25 altında bir tavan belirle ve plana onu uygula. Günlük toplamlar bu tavanı aşmasın."
    : targetKcal > 0
      ? `Kullanıcı günlük tavan kalori istedi: ${targetKcal} kcal. Toplamları bu sayının üstüne çıkarma.`
      : "";
  const targetKcalLineEn = isDeficit
    ? targetKcal > 0
      ? `User is in 'Calorie deficit' mode and wants a HARD CAP of ${targetKcal} kcal/day. Daily totals must NEVER exceed it; create a clear deficit each day.`
      : "User is in 'Calorie deficit' mode. Choose a cap 15–25% below TDEE and never exceed it in any day's total."
    : targetKcal > 0
      ? `User requested a daily calorie cap of ${targetKcal} kcal. Do not exceed it.`
      : "";

  const targetWeightLineTr =
    targetWeight > 0
      ? `Hedef kilo: ${targetWeight} kg (mevcut ${weight} kg). Plana bu kiloya ulaşmayı destekleyecek kalori ve makro stratejisini açıkça uygula. Haftada 0.4-0.7 kg gibi sağlıklı değişim sınırlarına bağlı kal.`
      : "Hedef kilo belirtilmedi; mevcut kiloya göre genel hedef takip edilsin.";
  const targetWeightLineEn =
    targetWeight > 0
      ? `Target weight: ${targetWeight} kg (current ${weight} kg). Apply a calorie + macro strategy that supports reaching this target. Stay within healthy 0.4-0.7 kg/week change ranges.`
      : "No target weight given; follow general goal based on current weight.";

  const dietitianPersonaTr =
    "Sen klinik tecrübeli, profesyonel bir diyetisyensin. Beslenmenin yanı sıra hedefe uygun haftalık egzersiz/kardiyo programını da reçete edersin. Yürüyüş, koşu, HIIT, güç antrenmanı sıklığını ve süresini açık yaz.";
  const dietitianPersonaEn =
    "You are an experienced clinical dietitian. Beyond nutrition, prescribe a weekly exercise/cardio plan aligned with the goal. Detail walking, running, HIIT, strength training frequency and duration.";

  const styleBlockTr =
    dietStyle === "keto"
      ? `DİYET STİLİ: KETOJENİK (KETO)
- Makro hedefi: ~%70-75 yağ, ~%20-25 protein, %5'in altında karbonhidrat (günlük net karb 20-50 gr).
- Şeker, ekmek, makarna, pirinç, patates, mısır, balla tatlandırılmış ürünler ve yüksek karbonhidratlı meyveler kullanılmaz.
- Tercih edilen besinler: yumurta, et/tavuk/balık, peynir, yoğurt (tam yağlı, az şekerli), avokado, zeytinyağı, tereyağı, fındık/badem, yeşil yapraklı sebzeler, brokoli, karnabahar, kabak, salatalık, az miktarda kırmızı meyve.
- Her öğün için bir karbonhidrat tahmini (gr) ekle ve günlük net karbı 50 gr'ı geçirme.
- Plan keto'ya geçiş gerekiyorsa kısa "keto adaptasyon" notu ekle (su/elektrolit dengesi).`
      : dietStyle === "omad"
        ? `DİYET STİLİ: OMAD (ONE MEAL A DAY)
- Tüm günlük kalori, makro ve mikro besinler TEK bir öğünde tüketilir; pencere yaklaşık 1 saat.
- 'content' alanında sadece TEK bir başlık olmalı: 'TEK ÖĞÜN (AKŞAM PENCERESİ)'. Kahvaltı/öğle/ara öğün YAZMA.
- Tek öğünde proteini (en az 1.6 g/kg vücut), sebzeyi, sağlıklı yağları ve karmaşık karbonhidratı dengeli ver.
- Pencere dışında sadece su, sade çay/kahve içilir; kalori girişi yoktur.
- Mineral ve elektrolit (sodyum, potasyum, magnezyum) için kısa bir uyarı ekle.
- Her gün için 'GÜNLÜK TOPLAM' satırı yine yer alsın.`
        : `DİYET STİLİ: STANDART
- Klasik 3 ana + 2 ara öğün yapısını koru. Türk mutfağıyla uyumlu, dengeli porsiyonlar.`;

  const styleBlockEn =
    dietStyle === "keto"
      ? `DIET STYLE: KETOGENIC (KETO)
- Macro target: ~70-75% fat, ~20-25% protein, under 5% carbs (daily net carbs 20-50 g).
- Avoid sugar, bread, pasta, rice, potatoes, corn, sweetened products and high-carb fruits.
- Preferred foods: eggs, meat/chicken/fish, cheese, full-fat low-sugar yogurt, avocado, olive oil, butter, nuts, leafy greens, broccoli, cauliflower, zucchini, cucumber, small portions of berries.
- For each meal include carbohydrate estimate (g); keep daily net carbs under 50 g.
- If keto adaptation is needed, add a short note about water/electrolyte balance.`
      : dietStyle === "omad"
        ? `DIET STYLE: OMAD (ONE MEAL A DAY)
- All daily calories, macros and micronutrients consumed in a SINGLE meal in roughly a 1-hour window.
- In 'content' use only ONE heading: 'ONE MEAL (EVENING WINDOW)'. Do NOT include breakfast/lunch/snack.
- Pack the single meal with sufficient protein (≥ 1.6 g/kg body), vegetables, healthy fats and complex carbs in balance.
- Outside the window only water/plain tea or coffee; no caloric intake.
- Add a short electrolyte caution (sodium, potassium, magnesium).
- Still include a 'DAILY TOTAL' line per day.`
        : `DIET STYLE: STANDARD
- Keep the classic 3 main + 2 snack structure. Balanced portions, accessible foods.`;

  const userBlockTr = `Kullanıcı Bilgileri:
- Boy: ${height} cm
- Kilo: ${weight} kg
- Yaş: ${age}
- Cinsiyet: ${gender === "female" ? "Kadın" : "Erkek"}
- Aktivite Seviyesi: ${normalizeActivity(activityLevel, "tr")}
- Hedef: ${goalLabelTr[goal]}
${targetWeightLineTr}
${pantryContextLine}
${budgetLineTr}
${targetKcalLineTr}

${styleBlockTr}`;

  const userBlockEn = `User Profile:
- Height: ${height} cm
- Weight: ${weight} kg
- Age: ${age}
- Gender: ${gender}
- Activity Level: ${normalizeActivity(activityLevel, "en")}
- Goal: ${goalLabelEn[goal]}
${targetWeightLineEn}
${pantryContextLine}
${budgetLineEn}
${targetKcalLineEn}

${styleBlockEn}`;

  if (frequency === "single") {
    const mealSkeletonTr =
      dietStyle === "omad"
        ? `GÜNLÜK PLAN
TEK ÖĞÜN (AKŞAM PENCERESİ):
- (Bütün günlük kaloriyi tek seferde dengeli ver: protein, sebze, sağlıklı yağ, karmaşık karbonhidrat)
GÜNLÜK TOPLAM: ~kalori, protein/karb/yağ`
        : dietStyle === "keto"
          ? `GÜNLÜK PLAN
KAHVALTI:
- (Düşük karbonhidrat, yüksek yağ; karb miktarını gr olarak yaz)
ARA ÖĞÜN:
- (Keto uyumlu)
ÖĞLE:
- (Düşük karb, yüksek yağ)
ARA ÖĞÜN:
- (Keto uyumlu)
AKŞAM:
- (Düşük karb, yüksek yağ)
GÜNLÜK TOPLAM: ~kalori, protein/karb (NET <50g)/yağ`
          : `GÜNLÜK PLAN
KAHVALTI:
- ...
ARA ÖĞÜN:
- ...
ÖĞLE:
- ...
ARA ÖĞÜN:
- ...
AKŞAM:
- ...
GÜNLÜK TOPLAM: ~kalori, protein/karb/yağ`;

    const mealSkeletonEn =
      dietStyle === "omad"
        ? `DAILY PLAN
ONE MEAL (EVENING WINDOW):
- (All daily calories balanced in one sitting: protein, vegetables, healthy fats, complex carbs)
DAILY TOTAL: ~kcal, protein/carbs/fat`
        : dietStyle === "keto"
          ? `DAILY PLAN
BREAKFAST:
- (Low carb, high fat; carb amount in g)
SNACK:
- (Keto compliant)
LUNCH:
- (Low carb, high fat)
SNACK:
- (Keto compliant)
DINNER:
- (Low carb, high fat)
DAILY TOTAL: ~kcal, protein/carbs (NET <50g)/fat`
          : `DAILY PLAN
BREAKFAST:
- ...
SNACK:
- ...
LUNCH:
- ...
SNACK:
- ...
DINNER:
- ...
DAILY TOTAL: ~kcal, protein/carbs/fat`;

    const trPrompt = `${dietitianPersonaTr}

${userBlockTr}

Bu verilere göre tek bir günlük diyet planı kur. Diyet stilini (yukarıda belirtildi) sıkı sıkıya uygula. Çıktıyı tam olarak şu formatta üret (başka başlık ekleme):

ÖZET
- BMR / TDEE / hedef kalori / makro özeti.
- Hedef kiloya ulaşma stratejisi (diyet stiline uygun).

${mealSkeletonTr}

BÜTÇE
- 1-2 cümle bütçe notu (yoksa 'Bütçe sınırı belirtilmedi').

EGZERSİZ / KARDİYO
- Haftalık egzersiz programı: yürüyüş/koşu/HIIT/güç antrenmanı, gün ve dakika ile.

PRATİK NOTLAR
- 2-3 kısa diyetisyen tavsiyesi. ${dietStyle === "keto" ? "Keto için elektrolit ve su tüketimine dikkat çek." : ""} ${dietStyle === "omad" ? "OMAD için elektrolit dengesi ve pencere disiplinine değin." : ""}

Kurallar:
- ASLA LaTeX, '#', '**', '\\[' kullanma.
- Açık, başlıklı düz metin.
- Net porsiyon ve gramaj kullan.`;

    const enPrompt = `${dietitianPersonaEn}

${userBlockEn}

Build a single daily plan. Strictly apply the diet style stated above. Use exactly this format (no extra headings):

SUMMARY
- BMR / TDEE / calorie target / macro summary.
- Strategy to reach the target weight (consistent with the diet style).

${mealSkeletonEn}

BUDGET
- 1-2 sentences budget note (or 'No budget cap specified').

EXERCISE / CARDIO
- Weekly program: walking/running/HIIT/strength, days and minutes.

PRACTICAL TIPS
- 2-3 short dietitian tips. ${dietStyle === "keto" ? "For keto, mention electrolytes and hydration." : ""} ${dietStyle === "omad" ? "For OMAD, mention electrolyte balance and window discipline." : ""}

Rules:
- Never use LaTeX, '#', '**', '\\['.
- Plain text with clear headings.
- Use explicit portions and grams.`;

    const result = streamText({
      model,
      prompt: lang === "en" ? enPrompt : trPrompt,
      temperature: mode === "dietitian" ? 0.5 : 0.4,
    });

    const encoder = new TextEncoder();
    let accumulated = "";
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            accumulated += chunk;
            const partial: SinglePlan = {
              type: "single",
              planText: cleanInline(accumulated).trim(),
              exercise: "",
            };
            controller.enqueue(encoder.encode(JSON.stringify(partial) + "\n"));
          }
          const final: SinglePlan = {
            type: "single",
            planText: cleanInline(accumulated).trim(),
            exercise: "",
          };
          await supabase.from("admin_audit_logs").insert({
            user_id: user.id,
            event_type: "diet_plan_saved",
            payload: {
              planJson: final,
              input: { height, weight, age, targetWeight, gender, activityLevel, goal, lang },
              frequentIngredients,
              mode,
              frequency,
              dietStyle,
              budgetMonthlyTl,
              targetKcal,
              targetWeight,
              goal,
              generatedFrom: "ai-stream",
            },
          });
        } catch (err) {
          console.log("[diet-plan] streamText error", err);
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ error: "Plan oluşturulurken hata oluştu." }) + "\n",
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, { headers: ndjsonHeaders() });
  }

  const weekCount = frequency === "monthly" ? 4 : 1;
  const dayNames = lang === "tr" ? trDayNames : enDayNames;
  const weekLabelHint =
    lang === "tr"
      ? `Hafta etiketleri: ${Array.from({ length: weekCount }, (_, i) => `${i + 1}. Hafta`).join(", ")}.`
      : `Week labels: ${Array.from({ length: weekCount }, (_, i) => `Week ${i + 1}`).join(", ")}.`;

  const trMultiPrompt = `${dietitianPersonaTr}

${userBlockTr}

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
- 'intro' alanı BMR/TDEE/kalori/makro özet ve hedef kilo stratejisini içersin.
- 'exercise' alanına haftalık egzersiz/kardiyo programı yaz: hangi gün hangi aktivite (yürüyüş/koşu/HIIT/güç), kaç dakika, dinlenme günleri. Hedef ve aktivite seviyesine uygun.
- LaTeX, '\\[', '#', '**' kullanma.`;

  const enMultiPrompt = `${dietitianPersonaEn}

${userBlockEn}

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
- 'intro' should summarise BMR/TDEE/calories/macros and the target-weight strategy.
- 'exercise' must contain a weekly cardio/strength program: which day which activity (walking/running/HIIT/strength), duration, rest days, aligned to the goal and activity level.
- Do not use LaTeX, '\\[', '#', '**'.`;

  const result = streamObject({
    model,
    schema: MultiPlanSchema,
    prompt: lang === "en" ? enMultiPrompt : trMultiPrompt,
    temperature: mode === "dietitian" ? 0.6 : 0.5,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let lastSent = "";
      try {
        for await (const partial of result.partialObjectStream) {
          const normalized = normalizeMulti(
            partial as MultiPartial,
            weekCount,
            lang,
          );
          const line = JSON.stringify(normalized);
          if (line === lastSent) continue;
          lastSent = line;
          controller.enqueue(encoder.encode(line + "\n"));
        }
        const finalObj = await result.object;
        const finalNormalized = normalizeMulti(
          finalObj as MultiPartial,
          weekCount,
          lang,
        );
        const finalLine = JSON.stringify(finalNormalized);
        if (finalLine !== lastSent) {
          controller.enqueue(encoder.encode(finalLine + "\n"));
        }
        await supabase.from("admin_audit_logs").insert({
          user_id: user.id,
          event_type: "diet_plan_saved",
          payload: {
            planJson: finalNormalized,
            input: { height, weight, age, targetWeight, gender, activityLevel, goal, lang },
            frequentIngredients,
            mode,
            frequency,
            dietStyle,
            budgetMonthlyTl,
            targetKcal,
            targetWeight,
            goal,
            generatedFrom: "ai-stream",
          },
        });
      } catch (err) {
        console.log("[diet-plan] streamObject error", err);
        controller.enqueue(
          encoder.encode(
            JSON.stringify({ error: "Plan oluşturulurken hata oluştu." }) + "\n",
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: ndjsonHeaders() });
}
