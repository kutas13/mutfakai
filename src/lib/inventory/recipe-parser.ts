import type { DeductionLine } from "@/lib/inventory/deductStocks";

function cleanIngredientName(raw: string): string {
  return raw
    .replace(/^\s*[-*•\d.)]+\s*/g, "")
    .replace(/\b\d+[.,]?\d*\b/g, "")
    .replace(
      /\b(su bardağı|yemek kaşığı|çay kaşığı|cup|tablespoon|teaspoon|tbsp|tsp|adet|piece)\b/gi,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function parseDeductionsFromRecipeText(text: string): DeductionLine[] {
  const matches = [
    ...text.matchAll(/([^\n()]{2,}?)\s*\(([\d.,]+)\s*(gr|ml|adet)\)/gi),
  ];
  const parsed: DeductionLine[] = [];

  for (const match of matches) {
    const left = match[1] ?? "";
    const amount = Number((match[2] ?? "").replace(",", "."));
    const unit = (match[3] ?? "").toLowerCase() as DeductionLine["unit"];
    const itemName = cleanIngredientName(left);
    if (!itemName || Number.isNaN(amount) || amount <= 0) continue;
    parsed.push({
      itemName,
      amountToSubtract: Number(amount.toFixed(3)),
      unit,
    });
  }

  const unique = new Map<string, DeductionLine>();
  for (const line of parsed) {
    const key = `${line.itemName.toLocaleLowerCase("tr-TR")}-${line.unit}`;
    const existing = unique.get(key);
    if (!existing) {
      unique.set(key, line);
      continue;
    }
    existing.amountToSubtract = Number(
      (existing.amountToSubtract + line.amountToSubtract).toFixed(3),
    );
  }

  return [...unique.values()];
}
