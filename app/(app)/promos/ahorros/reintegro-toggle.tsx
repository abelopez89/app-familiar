"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { marcarReintegro } from "../usar/actions";

/** Marcar un reintegro como acreditado (ya apareció en el extracto) o volverlo a pendiente. */
export function ReintegroToggle({ id, acreditado }: { id: string; acreditado: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <label className="tap-target flex items-center gap-2 text-xs">
      <Checkbox
        checked={acreditado}
        disabled={pending}
        onCheckedChange={(v) =>
          startTransition(async () => {
            const result = await marcarReintegro(id, v === true);
            if (result.error) toast.error(result.error);
          })
        }
      />
      {acreditado ? "Acreditado" : "Marcar acreditado"}
    </label>
  );
}
