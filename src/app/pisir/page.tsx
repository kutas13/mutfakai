import { Suspense } from "react";
import { PisirChefExperience } from "@/components/pisir/PisirChefExperience";

export default function PisirPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center text-sm text-neutral-600">Yükleniyor…</div>
      }
    >
      <PisirChefExperience />
    </Suspense>
  );
}
