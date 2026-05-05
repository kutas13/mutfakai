import { createClient } from "@/lib/supabase/client";

export async function logAuthEvent(
  eventType: "user_login" | "user_logout",
  extra: Record<string, unknown> = {},
) {
  try {
    const sb = createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return;
    await sb.from("admin_audit_logs").insert({
      user_id: user.id,
      event_type: eventType,
      payload: {
        email: user.email,
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 240) : null,
        at: new Date().toISOString(),
        ...extra,
      },
    });
  } catch (err) {
    console.log("[auth-log] insert error", err);
  }
}
