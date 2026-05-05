export type InputUnit =
  | "gr"
  | "kg"
  | "adet"
  | "ml"
  | "lt"
  | "su_bardagi"
  | "yemek_kasigi"
  | "cay_kasigi";
export type BaseUnit = "gr" | "ml" | "adet";

export const INPUT_UNITS: { value: InputUnit; label: string; labelEn: string }[] = [
  { value: "gr", label: "Gram (gr)", labelEn: "Gram (g)" },
  { value: "kg", label: "Kilogram (kg)", labelEn: "Kilogram (kg)" },
  { value: "adet", label: "Adet", labelEn: "Piece" },
  { value: "ml", label: "Mililitre (ml)", labelEn: "Milliliter (ml)" },
  { value: "lt", label: "Litre (lt)", labelEn: "Liter (l)" },
  { value: "su_bardagi", label: "Su Bardağı", labelEn: "Cup" },
  { value: "yemek_kasigi", label: "Yemek Kaşığı", labelEn: "Tablespoon" },
  { value: "cay_kasigi", label: "Çay Kaşığı", labelEn: "Teaspoon" },
];

function normalizeIngredientName(name: string): string {
  return name
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/\s+/g, " ")
    .trim();
}

const CUPS_IN_TABLESPOON = 1 / 13.3333;
const CUPS_IN_TEASPOON = 1 / 40;
const DEFAULT_CUP_GR = 120;

const DENSITY_CUP_MAP: Record<string, { baseUnit: BaseUnit; perCup: number }> = {
  un: { baseUnit: "gr", perCup: 140 },
  su: { baseUnit: "ml", perCup: 200 },
  sut: { baseUnit: "ml", perCup: 200 },
  zeytinyagi: { baseUnit: "ml", perCup: 180 },
  "sivi yag": { baseUnit: "ml", perCup: 180 },
  seker: { baseUnit: "gr", perCup: 170 },
  pirinc: { baseUnit: "gr", perCup: 180 },
  bulgur: { baseUnit: "gr", perCup: 170 },
  mercimek: { baseUnit: "gr", perCup: 180 },
};

function lookupDensity(ingredientName?: string): { baseUnit: BaseUnit; perCup: number } {
  const name = normalizeIngredientName(ingredientName ?? "");
  if (!name) return { baseUnit: "gr", perCup: DEFAULT_CUP_GR };

  for (const key of Object.keys(DENSITY_CUP_MAP)) {
    if (name.includes(key)) return DENSITY_CUP_MAP[key];
  }
  return { baseUnit: "gr", perCup: DEFAULT_CUP_GR };
}

export function toBaseUnit(
  quantity: number,
  unit: InputUnit,
  ingredientName?: string,
): { quantity: number; unit: BaseUnit } {
  switch (unit) {
    case "kg":
      return { quantity: quantity * 1000, unit: "gr" };
    case "lt":
      return { quantity: quantity * 1000, unit: "ml" };
    case "gr":
      return { quantity, unit: "gr" };
    case "ml":
      return { quantity, unit: "ml" };
    case "adet":
      return { quantity, unit: "adet" };
    case "su_bardagi": {
      const density = lookupDensity(ingredientName);
      return { quantity: quantity * density.perCup, unit: density.baseUnit };
    }
    case "yemek_kasigi": {
      const density = lookupDensity(ingredientName);
      return {
        quantity: quantity * density.perCup * CUPS_IN_TABLESPOON,
        unit: density.baseUnit,
      };
    }
    case "cay_kasigi": {
      const density = lookupDensity(ingredientName);
      return {
        quantity: quantity * density.perCup * CUPS_IN_TEASPOON,
        unit: density.baseUnit,
      };
    }
  }
}

export function toDisplayUnit(quantity: number, baseUnit: BaseUnit): { quantity: number; unit: string } {
  if (baseUnit === "gr" && quantity >= 1000) {
    return { quantity: +(quantity / 1000).toFixed(2), unit: "kg" };
  }
  if (baseUnit === "ml" && quantity >= 1000) {
    return { quantity: +(quantity / 1000).toFixed(2), unit: "lt" };
  }
  return { quantity: +quantity.toFixed(1), unit: baseUnit };
}

export function formatDisplay(quantity: number, baseUnit: BaseUnit): string {
  const d = toDisplayUnit(quantity, baseUnit);
  return `${d.quantity} ${d.unit}`;
}
