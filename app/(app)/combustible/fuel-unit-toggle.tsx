"use client";

import { useTransition } from "react";
import { setFuelUnit } from "./unit-actions";
import { FUEL_UNITS, type FuelUnit } from "@/lib/fuel/efficiency";
import { cn } from "@/lib/utils";

/** Selector de unidad de rendimiento: L/100 km (por defecto) o km/L. */
export function FuelUnitToggle({ unit }: { unit: FuelUnit }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <span className="text-xs text-muted-foreground">Rendimiento en</span>
      <div className="grid grid-cols-2 rounded-lg bg-muted p-0.5 text-xs font-medium" aria-busy={isPending}>
        {(Object.keys(FUEL_UNITS) as FuelUnit[]).map((u) => (
          <button
            key={u}
            type="button"
            aria-pressed={unit === u}
            disabled={isPending}
            onClick={() => startTransition(() => setFuelUnit(u))}
            className={cn(
              "rounded-md px-3 py-1.5 transition-colors",
              unit === u ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {FUEL_UNITS[u].short}
          </button>
        ))}
      </div>
    </div>
  );
}
