import type { KitchenUnit, RecipeIngredient } from "@/lib/recipes/catalog";

export type PantryRow = {
  id: string;
  name: string;
  quantity: number;
  unit: KitchenUnit;
};

export function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
}

function namesRoughlyMatch(pantryName: string, recipeName: string): boolean {
  const a = normalizeName(pantryName);
  const b = normalizeName(recipeName);
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const bHead = b.split(" ")[0];
  if (bHead.length >= 3 && (a.includes(bHead) || b.includes(a.split(" ")[0])))
    return true;
  return false;
}

export function findPantryRowForIngredient(
  rows: PantryRow[],
  need: RecipeIngredient,
): PantryRow | undefined {
  const sameUnit = rows.filter((r) => r.unit === need.unit);
  const exact = sameUnit.find(
    (r) => normalizeName(r.name) === normalizeName(need.name),
  );
  if (exact) return exact;
  return sameUnit.find((r) => namesRoughlyMatch(r.name, need.name));
}

export type StockIssue = {
  name: string;
  need: number;
  unit: KitchenUnit;
  have: number;
};

export type StockCheckResult =
  | { ok: true }
  | { ok: false; missing: StockIssue[] };

export function checkStock(
  rows: PantryRow[],
  ingredients: RecipeIngredient[],
): StockCheckResult {
  const missing: StockIssue[] = [];

  for (const need of ingredients) {
    const row = findPantryRowForIngredient(rows, need);
    const have = row ? Number(row.quantity) : 0;
    if (!row || have + 1e-9 < need.quantity) {
      missing.push({
        name: need.name,
        need: need.quantity,
        unit: need.unit,
        have,
      });
    }
  }

  if (missing.length) return { ok: false, missing };
  return { ok: true };
}
