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

type FortuneBody = {
  fullName?: string;
  dob?: string;
  relationship?: "yes" | "no";
  partnerName?: string;
  images?: string[];
  lang?: "tr" | "en";
};

export const runtime = "nodejs";
export const maxDuration = 60;

function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

const ZODIAC_TR = [
  "Oğlak",
  "Kova",
  "Balık",
  "Koç",
  "Boğa",
  "İkizler",
  "Yengeç",
  "Aslan",
  "Başak",
  "Terazi",
  "Akrep",
  "Yay",
  "Oğlak",
] as const;

const ZODIAC_EN = [
  "Capricorn",
  "Aquarius",
  "Pisces",
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
] as const;

// 0=Jan...11=Dec; threshold day where the next sign begins
const ZODIAC_DAYS = [20, 19, 21, 20, 21, 21, 23, 23, 23, 23, 22, 22] as const;

function computeZodiac(dobIso: string, lang: "tr" | "en"): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dobIso);
  if (!m) return lang === "en" ? "Unknown" : "Bilinmiyor";
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const idx = day < ZODIAC_DAYS[month] ? month : month + 1;
  const arr = lang === "en" ? ZODIAC_EN : ZODIAC_TR;
  return arr[idx];
}

function formatTodayTr(d: Date) {
  const months = [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
  ];
  const days = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatTodayEn(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function fmtDateTr(d: Date) {
  const months = [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
  ];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function fmtDateEn(d: Date) {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium")
    .eq("id", user.id)
    .single();
  const allow = isAdmin(user.email) || Boolean(profile?.is_premium);
  if (!allow) {
    return jsonResponse(
      { error: "Bu özellik Premium üyelere özeldir." },
      { status: 403 },
    );
  }

  let body: FortuneBody;
  try {
    body = (await request.json()) as FortuneBody;
  } catch {
    return jsonResponse({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  const fullName = (body.fullName ?? "").trim();
  const dob = (body.dob ?? "").trim();
  const relationship: "yes" | "no" = body.relationship === "yes" ? "yes" : "no";
  const partnerName = (body.partnerName ?? "").trim();
  const images = Array.isArray(body.images) ? body.images.slice(0, 10) : [];
  const lang = body.lang === "en" ? "en" : "tr";

  if (!fullName || !dob) {
    return jsonResponse(
      { error: "Ad Soyad ve Doğum Tarihi gerekli." },
      { status: 400 },
    );
  }
  if (images.length === 0) {
    return jsonResponse(
      { error: "En az bir kahve fincanı fotoğrafı gerekli." },
      { status: 400 },
    );
  }

  const model = getOpenAIModel();
  if (!model) {
    return jsonResponse({ error: "OPENAI_API_KEY eksik." }, { status: 503 });
  }

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const todayTr = formatTodayTr(today);
  const todayEn = formatTodayEn(today);
  const zodiacTr = computeZodiac(dob, "tr");
  const zodiacEn = computeZodiac(dob, "en");

  const dateRefTr = `Tarih referansı (BU TARİHLERİ KULLAN, başka tarih uydurma):
- Bugün: ${todayTr} (${todayIso})
- 1 hafta sonra: ${fmtDateTr(addDays(today, 7))}
- 2 hafta sonra: ${fmtDateTr(addDays(today, 14))}
- 3 hafta sonra: ${fmtDateTr(addDays(today, 21))}
- 1 ay sonra: ${fmtDateTr(addDays(today, 30))}
- 2 ay sonra: ${fmtDateTr(addDays(today, 60))}
- 3 ay sonra: ${fmtDateTr(addDays(today, 90))}`;

  const dateRefEn = `Date reference (USE THESE DATES; do not invent others):
- Today: ${todayEn} (${todayIso})
- 1 week from now: ${fmtDateEn(addDays(today, 7))}
- 2 weeks from now: ${fmtDateEn(addDays(today, 14))}
- 3 weeks from now: ${fmtDateEn(addDays(today, 21))}
- 1 month from now: ${fmtDateEn(addDays(today, 30))}
- 2 months from now: ${fmtDateEn(addDays(today, 60))}
- 3 months from now: ${fmtDateEn(addDays(today, 90))}`;

  const systemTr = `Sen gerçek bir kahve falcısısın (Falcı Bacı). Belleğini sıfırla ve kullanıcıyı hiç tanımıyormuşsun gibi davran. Gelen fincan fotoğraflarındaki sembolleri tek tek analiz et. Masalsı anlatımdan kaçın, sembollere odaklan. Üslubun samimi, esrarengiz, deneyimli ve kesin olsun. ASLA tıbbi tavsiye, garanti vaadi veya alay içeren ifade verme.

ZAMAN VE TARİH KURALI (ÇOK ÖNEMLİ):
- Sana sistemde bugünün tarihi ve "X hafta/ay sonra" karşılığı tarihler verilecek.
- "2 hafta sonra" derken MUTLAKA verilen 2 hafta karşılığı tarihi kullan.
- "Ekim", "Kasım" gibi rastgele aylar UYDURMA. Sadece sana verilen tarih referansını kullan.
- Belirsiz "yakında, ileride" ifadelerinden kaçın; ay+gün ver.

UZUNLUK VE DERİNLİK KURALI:
- Yorumun TOPLAM en az 600 kelime olmalı, en fazla 1100 kelime.
- Her ana bölümde en az 2-4 sembol/figür ismi geçir (kuş, balık, kalp, ay, kapı, yol, halka, yıldız, harf vb.).
- Her bölümde 4-7 cümle yaz; tek satırla geçiştirme.
- Aşk bölümünde harf ipucu (ör. "İsmi A veya M ile başlayan biri"), tarih ve enerji yönü ver.
- İş & Para bölümünde net hamle önerisi (ör. "ay sonuna kadar bir teklifi imzala", "yeni iş görüşmesi") ekle.
- Sağlık & Ev bölümünde uyku, su, ev içi ilişkiler veya küçük bir ev değişikliği gibi somut gözlemler ver (tıbbi tavsiye değil).
- Yakın Gelecek bölümünde 3-5 farklı net tarih hattı kur (1 hafta / 2 hafta / 1 ay / 2-3 ay).

ÇIKTI FORMATI (sıkı sıkıya uy, başka bölüm ekleme):

✨ Kısa Genel Özet
(4-6 cümle. Fincanın geneline bak; öne çıkan 2-3 sembolü adlandır ve tonu belirle.)

🌟 Burç Notu
(Kullanıcının burcu sana verilecek; burcun bu dönemdeki enerjisini kahvedeki sembollerle 3-5 cümlede birleştir.)

❤️ Aşk
(En az 6 cümle. Partner durumuna göre ayır:
- Bekarsa: yaklaşan tanışma, harf ipucu, ortam.
- İlişkide ise: partner ismi anılarak ilişki dengesi, küçük gerilim/uzlaşma, atılacak adım.
Kahvedeki sembolleri ad ad göster.)

💼 İş & Para
(En az 6 cümle. Para akışı, gelen-giden, fırsat penceresi, birlikte çalışılacak biri, dikkat edilmesi gereken evrak/imza, küçük finansal hediye veya sürpriz.)

🌿 Sağlık & Ev
(En az 4 cümle. Enerji seviyesi, uyku, ev içinde tatlı/küçük tartışma, ev eşyası değişikliği, ziyaret. Tıbbi teşhis yok.)

🔮 Yakın Gelecek (Net Vade)
(Madde madde 4-6 satır. Her satır şu kalıpta: "[Net Tarih] — [olay/ipucu]". Sadece sana verilen tarih referanslarını kullan.)

— Kişi: ${fullName} | D.T: ${dob} (${zodiacTr}) | İlişki: ${relationship === "yes" ? `Var${partnerName ? ` — ${partnerName}` : ""}` : "Yok"}

DİL VE FORMAT KURALI:
- LaTeX, '\\[', '#', '**' kullanma. Sade düz metin yaz.
- Sembol uydurma; fincanda göremediğin şeyi söyleme. Net görmediğinde "kenarda silikçe görünen…" gibi yumuşat.`;

  const systemEn = `You are a real coffee fortune teller (Falcı Bacı). Erase memory; pretend you don't know the user. Analyse the symbols in the cup photos one by one. No fairy-tale fluff — focus on symbols. Tone: warm, mysterious, experienced, decisive. Never give medical advice, guarantees or mockery.

DATE / TIME RULE (CRITICAL):
- The system will give you today's date and the dates that match "X weeks/months from now".
- When you say "2 weeks later" you MUST use exactly the date provided for 2 weeks.
- DO NOT invent random months like "October" or "November". Only use the provided date references.
- Avoid vague "soon, later" phrasing; give a month + day.

LENGTH AND DEPTH RULE:
- Total reading must be 600-1100 words.
- Each main section must mention 2-4 named symbols/figures (bird, fish, heart, moon, door, road, ring, star, letter, etc.).
- Each section must contain 4-7 sentences; no one-liners.
- Love section: include a letter hint (e.g. "name starting with A or M"), a date and a direction.
- Work & Money: concrete next move (e.g. "sign an offer before month end", "new interview ahead").
- Health & Home: sleep, hydration, household, small home change — concrete but not medical.
- Near Future: 3-5 distinct date lines (1 week / 2 weeks / 1 month / 2-3 months).

OUTPUT FORMAT (strict, no extra sections):

✨ Quick Summary
(4-6 sentences. Overall cup; name 2-3 standout symbols and set the tone.)

🌟 Zodiac Note
(Use the zodiac sign provided; combine the sign's current vibe with cup symbols in 3-5 sentences.)

❤️ Love
(At least 6 sentences. Branch by partner status:
- Single: incoming meeting, letter hint, environment.
- Partnered: name the partner; balance, small tension/resolution, next move.
Name cup symbols explicitly.)

💼 Work & Money
(At least 6 sentences. Cash flow, in/out, opportunity window, collaborator, paperwork/signature to watch, small financial surprise.)

🌿 Health & Home
(At least 4 sentences. Energy, sleep, household tension or move, household item change, visit. No medical claims.)

🔮 Near Future (Concrete dates)
(Bulleted, 4-6 lines. Each line: "[Concrete Date] — [event/hint]". Use only the provided date references.)

— Subject: ${fullName} | DOB: ${dob} (${zodiacEn}) | Relationship: ${relationship === "yes" ? `In a relationship${partnerName ? ` — ${partnerName}` : ""}` : "Single"}

LANGUAGE AND FORMAT RULE:
- No LaTeX, '\\[', '#', '**'. Plain prose.
- Don't invent symbols not visible. If unclear, soften: "faintly at the rim…".`;

  const userIntroTr = `Bilgilerim:
- Ad Soyad: ${fullName}
- Doğum Tarihi: ${dob}
- Burç: ${zodiacTr}
- İlişki Durumu: ${relationship === "yes" ? `Var (${partnerName || "partner ismi belirtilmedi"})` : "Yok"}

${dateRefTr}

Aşağıdaki ${images.length} kahve fincanı fotoğrafını incele ve yukarıdaki formata uygun, uzun ve detaylı bir fal yorumu hazırla.`;

  const userIntroEn = `My info:
- Full name: ${fullName}
- Date of birth: ${dob}
- Zodiac: ${zodiacEn}
- Relationship: ${relationship === "yes" ? `In a relationship (${partnerName || "partner name not specified"})` : "Single"}

${dateRefEn}

Analyse the ${images.length} coffee cup photo(s) below and produce a long, detailed reading in the format above.`;

  const result = streamText({
    model,
    system: lang === "en" ? systemEn : systemTr,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: lang === "en" ? userIntroEn : userIntroTr },
          ...images.map((img) => ({
            type: "image" as const,
            image: img,
          })),
        ],
      },
    ],
    temperature: 0.85,
    maxOutputTokens: 2200,
  });

  const encoder = new TextEncoder();
  let accumulated = "";
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.textStream) {
          accumulated += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
        const finalText = accumulated
          .replace(/\\\[/g, "")
          .replace(/\\\]/g, "")
          .replace(/\*\*/g, "")
          .replace(/^#\s*/gm, "")
          .trim();

        const dobValue =
          /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob : null;

        const { error: insertErr } = await supabase
          .from("fortune_readings")
          .insert({
            user_id: user.id,
            full_name: fullName,
            dob: dobValue,
            relationship,
            partner_name: partnerName || null,
            photo_count: images.length,
            fortune_text: finalText,
            lang,
          });
        if (insertErr) {
          console.log("[fortune] insert error", insertErr);
        }

        await supabase.from("admin_audit_logs").insert({
          user_id: user.id,
          event_type: "fortune_reading",
          payload: {
            fullName,
            dob,
            zodiac: zodiacTr,
            relationship,
            partnerName,
            photoCount: images.length,
            lang,
          },
        });
      } catch (err) {
        console.log("[fortune] streamText error", err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
