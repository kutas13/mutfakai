export type BaseUnit = "gr" | "ml" | "adet";

export type StockRow = {
  id: string;
  user_id: string;
  item_name: string;
  quantity: number;
  unit: BaseUnit;
};

export type UserProfile = {
  id: string;
  first_name: string;
  last_name: string;
  is_premium: boolean;
  lang: "tr" | "en";
};
