import type { FuelType } from "@/lib/supabase/types";

export const FUEL_TYPES: Record<FuelType, { label: string }> = {
  nafta: { label: "Nafta" },
  diesel: { label: "Diésel" },
  flex: { label: "Flex" },
  gnv: { label: "GNV" },
};

export const TANK_CAPACITY_OVERFILL_MARGIN = 0.1;
