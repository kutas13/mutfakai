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

  const systemTr = `Sen gerçek bir kahve falcısısın (Falcı Bacı). Belleğini sıfırla ve kullanıcıyı hiç tanımıyormuşsun gibi davran. Gelen fincan fotoğraflarındaki sembolleri tek tek analiz et. Masalsı anlatımdan kaçın, sembollere odaklan. Üslubun samimi, esrarengiz ama kesin olsun. ASLA tıbbi tavsiye, kesin tarih garantisi veya alay içeren ifade verme.

İstenen çıktı formatı (sıkı sıkıya uy, başka bölüm ekleme):

✨ Kısa Genel Özet
- 2-3 cümlelik genel fal yorumu.

❤️ Aşk
- Görseldeki figürlere ve partner/ilişki durumuna dayanarak harf/tarih/isim ipuçları vererek detaylı yorum yap.

💼 İş & Para
- Gelecek fırsatlar, tarihler, gelişmeler.

🌿 Sağlık & Ev
- Net ve kısa gözlemler.

🔮 Yakın Gelecek (Net Vade)
- Gün/hafta/ay bazında net tarihler ve ipuçları.

— Kişi: [İsim, Doğum Tarihi, İlişki Durumu, Partner İsmi]

Kurallar:
- LaTeX, '\\[', '#', '**' kullanma.
- Sade düz metin yaz.
- Fincanda görmediğin bir şey hakkında konuşma; gerçek görsel sembolden yorumla.`;

  const systemEn = `You are a real coffee fortune teller. Pretend you don't know the user; analyze the symbols in the cup photos one by one. No fairy-tale fluff — focus on symbols. Tone: warm, mysterious, decisive. Never give medical advice or mocking remarks.

Required output format (strict, no extra sections):

✨ Quick Summary
- 2-3 sentences general reading.

❤️ Love
- Detailed reading using figures in the cup and the user's relationship/partner info; offer letter/date/name hints.

💼 Work & Money
- Upcoming opportunities, dates, developments.

🌿 Health & Home
- Short, concrete observations.

🔮 Near Future
- Concrete day/week/month hints.

— Subject: [Name, Date of Birth, Relationship, Partner]

Rules:
- No LaTeX, '\\[', '#', '**'.
- Plain prose.
- Do not invent symbols not visible in the cup.`;

  const userIntroTr = `Bilgilerim:
- Ad Soyad: ${fullName}
- Doğum Tarihi: ${dob}
- İlişki Durumu: ${relationship === "yes" ? `Var (${partnerName || "partner ismi belirtilmedi"})` : "Yok"}

Aşağıdaki ${images.length} kahve fincanı fotoğrafını incele ve yukarıdaki formata uygun bir fal yorumu hazırla.`;

  const userIntroEn = `My info:
- Full name: ${fullName}
- Date of birth: ${dob}
- Relationship: ${relationship === "yes" ? `In a relationship (${partnerName || "partner name not specified"})` : "Single"}

Analyse the ${images.length} coffee cup photo(s) below and produce a reading in the format above.`;

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
