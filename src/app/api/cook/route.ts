import { createClient } from "@/lib/supabase/server";
import {
  checkStock,
  findPantryRowForIngredient,
  type PantryRow,
} from "@/lib/inventory/match";
import { getRecipeBySlug } from "@/lib/recipes/catalog";
import type { StockRow } from "@/types/stock";

function toPantry(rows: StockRow[]): PantryRow[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.item_name,
    quantity: r.quantity,
    unit: r.unit,
  }));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  let body: { recipeSlug?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const slug = body.recipeSlug;
  if (!slug || typeof slug !== "string") {
    return Response.json({ error: "Tarif seçilmedi" }, { status: 400 });
  }

  const recipe = getRecipeBySlug(slug);
  if (!recipe) {
    return Response.json({ error: "Tarif bulunamadı" }, { status: 404 });
  }

  const { data: rows, error } = await supabase
    .from("stocks")
    .select("id, user_id, item_name, quantity, unit")
    .eq("user_id", user.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const stockRows: StockRow[] = (rows ?? []).map((r) => ({
    id: r.id as string,
    user_id: r.user_id as string,
    item_name: r.item_name as string,
    quantity: Number(r.quantity),
    unit: r.unit as StockRow["unit"],
  }));

  const pantry = toPantry(stockRows);
  const stock = checkStock(pantry, recipe.ingredients);
  if (!stock.ok) {
    return Response.json(
      {
        error: "Stok yetersiz — mutfağını kontrol et.",
        missing: stock.missing,
      },
      { status: 400 },
    );
  }

  for (const need of recipe.ingredients) {
    const row = findPantryRowForIngredient(pantry, need);
    if (!row) {
      return Response.json(
        { error: "Eşleşen malzeme bulunamadı" },
        { status: 400 },
      );
    }
    const nextQty = Number(row.quantity) - need.quantity;
    if (nextQty <= 0) {
      const { error: delErr } = await supabase.from("stocks").delete().eq("id", row.id);
      if (delErr) {
        return Response.json({ error: delErr.message }, { status: 500 });
      }
    } else {
      const { error: upErr } = await supabase
        .from("stocks")
        .update({ quantity: nextQty })
        .eq("id", row.id);
      if (upErr) {
        return Response.json({ error: upErr.message }, { status: 500 });
      }
    }
    row.quantity = Math.max(0, nextQty);
  }

  return Response.json({ ok: true });
}
