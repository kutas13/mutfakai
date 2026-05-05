import { createClient } from "@/lib/supabase/server";
import type { StockRow } from "@/types/stock";

export type { StockRow };

/**
 * Oturum açmış kullanıcının tüm stok satırlarını `stocks` tablosundan döndürür.
 */
export async function getInventory(): Promise<StockRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("stocks")
    .select("id, user_id, item_name, quantity, unit")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((r) => ({
    id: r.id as string,
    user_id: r.user_id as string,
    item_name: r.item_name as string,
    quantity: Number(r.quantity),
    unit: r.unit as StockRow["unit"],
  }));
}

export function formatInventoryForPrompt(rows: StockRow[]): string {
  if (!rows.length) {
    return "(Şu an dolap/envanter boş — kullanıcıya önce mutfağa malzeme eklemesini öner.)";
  }
  return rows
    .map((r) => {
      const qty = r.quantity;
      const u = r.unit;
      if (u === "gr" && qty >= 1000) return `- ${r.item_name}: ${+(qty / 1000).toFixed(2)} kg (${qty} gr)`;
      if (u === "ml" && qty >= 1000) return `- ${r.item_name}: ${+(qty / 1000).toFixed(2)} lt (${qty} ml)`;
      return `- ${r.item_name}: ${qty} ${u}`;
    })
    .join("\n");
}
