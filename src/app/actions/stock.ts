"use server";

import { createClient } from "@/lib/supabase/server";
import {
  deductFromStocks,
  deductionsToRecipeNeeds,
  type DeductionLine,
} from "@/lib/inventory/deductStocks";
import { getInventory } from "@/lib/inventory/getInventory";
import { revalidatePath } from "next/cache";

export type UpdateStockResult =
  | { ok: true }
  | { ok: false; error: string; missing?: { name: string; need: number; unit: string; have: number }[] };

async function logAudit(
  eventType: string,
  userId: string,
  payload: Record<string, unknown>,
) {
  const supabase = await createClient();
  await supabase.from("admin_audit_logs").insert({
    user_id: userId,
    event_type: eventType,
    payload,
  });
}

/**
 * Tek bir ürün için mutfaktan düşüm (isim ve birim envanterdeki satırla eşleştirilir).
 */
export async function updateStock(
  itemName: string,
  amountToSubtract: number,
  unit: DeductionLine["unit"],
): Promise<UpdateStockResult> {
  return deductRecipeFromPantry([{ itemName, amountToSubtract, unit }]);
}

/**
 * Şef araçından gelen çoklu satırlar için stok düşümü.
 */
export async function deductRecipeFromPantry(
  lines: DeductionLine[],
): Promise<UpdateStockResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Oturum gerekli" };
  }

  if (!lines.length) {
    await logAudit("cook_failed", user.id, { reason: "empty_lines" });
    return { ok: false, error: "Tarif malzemesi yok" };
  }

  let rows;
  try {
    rows = await getInventory();
  } catch (e) {
    await logAudit("cook_failed", user.id, { reason: "inventory_read_failed" });
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Envanter okunamadı",
    };
  }

  const needs = deductionsToRecipeNeeds(lines);
  const result = await deductFromStocks(supabase, rows, needs);

  if (!result.ok) {
    await logAudit("cook_failed", user.id, {
      reason: "insufficient_stock",
      lines,
      missing: result.missing ?? [],
    });
    return {
      ok: false,
      error: result.error,
      missing: result.missing?.map((m) => ({
        name: m.name,
        need: m.need,
        unit: m.unit,
        have: m.have,
      })),
    };
  }

  revalidatePath("/mutfak");
  revalidatePath("/pisir");
  await logAudit("cook_success", user.id, { lines });
  return { ok: true };
}
