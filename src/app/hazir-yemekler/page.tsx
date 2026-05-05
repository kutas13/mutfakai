import Image from "next/image";
import Link from "next/link";
import { RECIPES } from "@/lib/recipes/catalog";
import { UsePantryButton } from "@/components/CookActions";

export default function HazirYemeklerPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-10 max-w-2xl">
        <h1 className="text-3xl font-bold text-[#2D5A27]">Hazır Yemek Kataloğu</h1>
        <p className="mt-2 text-neutral-600">
          Popüler Türk mutfağı tarifleri — detayları incele ve mutfağından tek tıkla
          malzeme düş.
        </p>
        <Link
          href="/pisir"
          className="mt-4 inline-flex text-sm font-semibold text-[#F28C28] hover:underline"
        >
          Pişir sekmesinde şef AI ile devam et
        </Link>
      </header>

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {RECIPES.map((recipe) => (
          <article
            key={recipe.slug}
            className="flex flex-col overflow-hidden rounded-2xl border border-[#2D5A27]/12 bg-white shadow-sm transition hover:border-[#F28C28]/35"
          >
            <div className="relative aspect-[4/3] w-full">
              <Image
                src={recipe.image}
                alt={recipe.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            </div>
            <div className="flex flex-1 flex-col p-5">
              <h2 className="text-lg font-semibold text-[#2D5A27]">{recipe.title}</h2>
              <p className="mt-1 flex-1 text-sm text-neutral-600">
                {recipe.shortDescription}
              </p>
              <p className="mt-3 text-xs text-neutral-500">
                ~{recipe.cookMinutes} dk · {recipe.ingredients.length} malzeme
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Link
                  href={`/pisir?recipe=${recipe.slug}`}
                  className="inline-flex justify-center rounded-full border border-[#2D5A27]/25 px-4 py-2 text-center text-sm font-semibold text-[#2D5A27] transition hover:border-[#2D5A27]/50"
                >
                  Pişir sayfasında aç
                </Link>
                <UsePantryButton recipeSlug={recipe.slug} />
              </div>
              <details className="mt-4 rounded-xl bg-[#faf8f5] p-3 text-sm">
                <summary className="cursor-pointer font-medium text-[#2D5A27]">
                  Tarif adımları
                </summary>
                <ol className="mt-2 list-decimal space-y-1 pl-4 text-neutral-700">
                  {recipe.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </details>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
