export type KitchenUnit = "gr" | "adet" | "ml";

export type RecipeIngredient = {
  name: string;
  quantity: number;
  unit: KitchenUnit;
};

export type Recipe = {
  slug: string;
  title: string;
  shortDescription: string;
  image: string;
  cookMinutes: number;
  ingredients: RecipeIngredient[];
  steps: string[];
};

export const RECIPES: Recipe[] = [
  {
    slug: "mercimek-corbasi",
    title: "Mercimek Çorbası",
    shortDescription: "Kırmızı mercimek, soğan ve nane ile klasik sıcak çorba.",
    image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&h=600&fit=crop",
    cookMinutes: 35,
    ingredients: [
      { name: "Mercimek", quantity: 200, unit: "gr" },
      { name: "Soğan", quantity: 1, unit: "adet" },
      { name: "Havuç", quantity: 1, unit: "adet" },
      { name: "Sıvı Yağ", quantity: 30, unit: "ml" },
      { name: "Tuz", quantity: 5, unit: "gr" },
    ],
    steps: [
      "Soğan ve havucu küçük küpler halinde doğrayın.",
      "Tencerede sıvı yağı kızdırıp soğan ve havucu 3-4 dk kavurun.",
      "Yıkanmış mercimeği ekleyip karıştırın.",
      "6 su bardağı sıcak su ilave edip kaynamaya bırakın.",
      "Kısık ateşte 25 dk pişirip blenderdan geçirin.",
      "Tuz ekleyip sıcak servis edin.",
    ],
  },
  {
    slug: "karniyarik",
    title: "Karnıyarık",
    shortDescription: "Patlıcan dolması; kıyma ve domates soslu fırın klasiği.",
    image: "https://images.unsplash.com/photo-1625944230945-1b7dd3b949ab?w=800&h=600&fit=crop",
    cookMinutes: 70,
    ingredients: [
      { name: "Patlıcan", quantity: 4, unit: "adet" },
      { name: "Dana Kıyma", quantity: 300, unit: "gr" },
      { name: "Soğan", quantity: 1, unit: "adet" },
      { name: "Domates", quantity: 2, unit: "adet" },
      { name: "Sıvı Yağ", quantity: 40, unit: "ml" },
    ],
    steps: [
      "Patlıcanları alacalı soyup derin yağda kızartın.",
      "Kıyma ve doğranmış soğanı kavurun, salça ve baharatları ekleyin.",
      "Patlıcanların ortasını açıp iç harcı doldurun.",
      "Üzerine domates dilimleri koyup 180°C fırında 30 dk pişirin.",
    ],
  },
  {
    slug: "tavuklu-pilav",
    title: "Tavuklu Pirinç Pilavı",
    shortDescription: "Tereyağlı tel şehriyeli, haşlanmış tavuk parçalı pilav.",
    image: "https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=800&h=600&fit=crop",
    cookMinutes: 45,
    ingredients: [
      { name: "Tavuk", quantity: 400, unit: "gr" },
      { name: "Pirinç", quantity: 250, unit: "gr" },
      { name: "Tel Şehriye", quantity: 50, unit: "gr" },
      { name: "Tereyağı", quantity: 40, unit: "gr" },
      { name: "Sıcak Su", quantity: 500, unit: "ml" },
    ],
    steps: [
      "Tavuğu haşlayıp didikin, suyunu ayırın.",
      "Tereyağında şehriyeyi pembeleştirip pirinci ekleyin.",
      "Tavuk suyunu ilave edip kısık ateşte 15 dk pişirin.",
      "Ocaktan alıp 10 dk dinlendirin, tavuk parçalarıyla karıştırıp servis edin.",
    ],
  },
  {
    slug: "menemen",
    title: "Menemen",
    shortDescription: "Domates, biber ve yumurtanın kahvaltılık uyumu.",
    image: "https://images.unsplash.com/photo-1590412200988-a436970781fa?w=800&h=600&fit=crop",
    cookMinutes: 20,
    ingredients: [
      { name: "Yumurta", quantity: 4, unit: "adet" },
      { name: "Domates", quantity: 2, unit: "adet" },
      { name: "Sivri Biber", quantity: 2, unit: "adet" },
      { name: "Sıvı Yağ", quantity: 25, unit: "ml" },
    ],
    steps: [
      "Biberleri ince kıyın, domatesleri küp küp doğrayın.",
      "Yağda biberleri 2 dk kavurun, domatesleri ekleyin.",
      "Suyunu salıp çekene kadar pişirin.",
      "Yumurtaları kırıp büyük parçalar halinde karıştırarak pişirin.",
      "Sıcak ekmek ile servis edin.",
    ],
  },
  {
    slug: "kisir",
    title: "Kısır",
    shortDescription: "Bulgurlu, yeşillikli, nar ekşili hafif salata.",
    image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&h=600&fit=crop",
    cookMinutes: 30,
    ingredients: [
      { name: "Bulgur", quantity: 200, unit: "gr" },
      { name: "Salatalık", quantity: 1, unit: "adet" },
      { name: "Domates", quantity: 1, unit: "adet" },
      { name: "Maydanoz", quantity: 30, unit: "gr" },
      { name: "Zeytinyağı", quantity: 60, unit: "ml" },
      { name: "Nar Ekşisi", quantity: 30, unit: "ml" },
    ],
    steps: [
      "İnce bulguru kaynar su ile şişirip 10 dk bekletin.",
      "Domates, salatalık ve maydanozu ince ince doğrayın.",
      "Bulgur soğuyunca doğranmış malzemeleri ekleyin.",
      "Zeytinyağı, nar ekşisi ve baharatla harmanlayın.",
      "Marul yapraklarıyla servis edin.",
    ],
  },
  {
    slug: "pizza",
    title: "Ev Yapımı Pizza",
    shortDescription: "Fırında çıtır hamurlu, peynirli, taze sebzeli pizza.",
    image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=600&fit=crop",
    cookMinutes: 40,
    ingredients: [
      { name: "Un", quantity: 300, unit: "gr" },
      { name: "Maya", quantity: 5, unit: "gr" },
      { name: "Kaşar Peynir", quantity: 200, unit: "gr" },
      { name: "Domates Salçası", quantity: 30, unit: "gr" },
      { name: "Zeytinyağı", quantity: 30, unit: "ml" },
    ],
    steps: [
      "Un, maya, su ve zeytinyağı ile hamuru yoğurun, 30 dk mayalandırın.",
      "Hamuru açıp üzerine salçalı sos sürün.",
      "Rendelenmiş kaşar peyniri ve dilediğiniz malzemeleri dizin.",
      "220°C fırında 12-15 dk altı çıtır olana dek pişirin.",
    ],
  },
];

export function getRecipeBySlug(slug: string): Recipe | undefined {
  return RECIPES.find((r) => r.slug === slug);
}

export function findRecipesByQuery(query: string): Recipe[] {
  const q = query.trim().toLocaleLowerCase("tr-TR");
  if (!q) return RECIPES.slice(0, 3);

  const scored = RECIPES.map((recipe) => {
    const title = recipe.title.toLocaleLowerCase("tr-TR");
    let score = 0;
    if (title.includes(q) || q.includes(title.split(" ")[0])) score += 3;
    for (const ing of recipe.ingredients) {
      if (ing.name.toLocaleLowerCase("tr-TR").includes(q)) score += 1;
    }
    return { recipe, score };
  }).filter((x) => x.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.length ? scored.map((s) => s.recipe) : RECIPES.slice(0, 2);
}
