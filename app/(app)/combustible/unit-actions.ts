"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { FUEL_UNIT_COOKIE, parseFuelUnit } from "@/lib/fuel/efficiency";

/** Cambia la unidad de rendimiento de este dispositivo (cookie de un año). */
export async function setFuelUnit(unit: string): Promise<void> {
  const store = await cookies();
  store.set(FUEL_UNIT_COOKIE, parseFuelUnit(unit), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/combustible", "layout");
}
