import { lazy, Suspense } from "react";
import type { Shelter } from "@/lib/types";

// react-leaflet is only pulled in when the map is actually rendered (lazy).
const ShelterMap = lazy(() => import("./ShelterMap"));

export function LazyShelterMap({ shelters }: { shelters: Shelter[] }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-80 items-center justify-center border border-border text-xs text-muted-foreground">
          Karte wird geladen …
        </div>
      }
    >
      <ShelterMap shelters={shelters} />
    </Suspense>
  );
}
