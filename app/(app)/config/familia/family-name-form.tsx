"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateFamilyName, type ActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function FamilyNameForm({ initialName }: { initialName: string }) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(
    updateFamilyName,
    {},
  );

  useEffect(() => {
    if (state.success) toast.success("Nombre de familia actualizado.");
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nombre de la familia</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" defaultValue={initialName} required />
          </div>
          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
