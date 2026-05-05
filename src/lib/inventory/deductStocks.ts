import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checkStock,
  findPantryRowForIngredient,
  type PantryRow,
  type StockIssue,
} from "@/lib/inventory/match";
import type { RecipeIngredient } from "@/lib/recipes/catalog";
import type { StockRow } from "@/types/stock";

function toPantryRows(rows: StockRow[]): PantryRow[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.item_name,
    quantity: r.quantity,
    unit: r.unit,
  }));
}

export type DeductionLine = {
  itemName: string;
  amountToSubtract: number;
  unit: RecipeIngredient["unit"];
};

/**
 * Tarif malzemelerine göre stoğu kontrol eder ve düşüm yapar.
 */
export async function deductFromStocks(
  supabase: SupabaseClient,
  rows: StockRow[],
  needs: RecipeIngredient[],
): Promise<
  | { ok: true }
  | { ok: false; error: string; missing?: StockIssue[] }
> {
  const pantry = toPantryRows(rows);
  const stock = checkStock(pantry, needs);
  if (!stock.ok) {
    return { ok: false, error: "Stok yetersiz — mutfağını kontrol et.", missing: stock.missing };
  }

  for (const need of needs) {
    const row = findPantryRowForIngredient(pantry, need);
    if (!row) {
      return { ok: false, error: "Eşleşen malzeme bulunamadı" };
    }
    const nextQty = Number(row.quantity) - need.quantity;
    if (nextQty <= 0) {
      const { error: delErr } = await supabase.from("stocks").delete().eq("id", row.id);
      if (delErr) return { ok: false, error: delErr.message };
    } else {
      const { error: upErr } = await supabase
        .from("stocks")
        .update({ quantity: nextQty })
        .eq("id", row.id);
      if (upErr) return { ok: false, error: upErr.message };
    }
    row.quantity = Math.max(0, nextQty);
  }

  return { ok: true };
}

/**
 * Şef araçından gelen satırları RecipeIngredient biçimine çevirir.
 */
export function deductionsToRecipeNeeds(lines: DeductionLine[]): RecipeIngredient[] {
  return lines.map((l) => ({
    name: l.itemName,
    quantity: l.amountToSubtract,
    unit: l.unit,
  }));
}
