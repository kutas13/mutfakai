import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createAdminClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type Body = {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return new Response(JSON.stringify({ error: "Geçersiz istek gövdesi" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const firstName = body.firstName?.trim() ?? "";
  const lastName = body.lastName?.trim() ?? "";

  if (!email || !password || password.length < 6) {
    return new Response(
      JSON.stringify({ error: "E-posta ve şifre (en az 6 karakter) zorunlu." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const admin = getAdminClient();
  if (!admin) {
    console.log("[register] missing SUPABASE_SERVICE_ROLE_KEY");
    return new Response(
      JSON.stringify({
        error:
          "Sunucu yapılandırması eksik. Lütfen yöneticiyle iletişime geçin.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName },
  });

  if (error || !data?.user) {
    const message = error?.message ?? "Kayıt oluşturulamadı";
    const lower = message.toLowerCase();
    if (
      lower.includes("already") ||
      lower.includes("registered") ||
      lower.includes("duplicate")
    ) {
      return new Response(
        JSON.stringify({ error: "Bu e-posta zaten kayıtlı. Lütfen giriş yap." }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      );
    }
    console.log("[register] create error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return Response.json({ ok: true, userId: data.user.id });
}
