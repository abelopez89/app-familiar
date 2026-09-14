"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createMember, updateMember, type ActionResult } from "../actions";
import type { FamilyMember } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const COLORS = [
  "#6366f1",
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#06b6d4",
  "#ec4899",
  "#8b5cf6",
];

export function MemberFormDialog({ member }: { member?: FamilyMember }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"adulto" | "menor">(member?.role ?? "adulto");
  const [color, setColor] = useState(member?.color ?? COLORS[0]);
  const action = member ? updateMember : createMember;
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(
    action,
    {},
  );

  useEffect(() => {
    if (state.success) {
      toast.success(member ? "Miembro actualizado." : "Miembro creado.");
      setOpen(false);
    }
    if (state.error) toast.error(state.error);
  }, [state, member]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {member ? (
          <Button variant="ghost" size="sm">
            Editar
          </Button>
        ) : (
          <Button className="gap-2">
            <Plus className="size-4" />
            Agregar miembro
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member ? "Editar miembro" : "Nuevo miembro"}</DialogTitle>
          <DialogDescription>
            {role === "adulto"
              ? "Los adultos pueden tener email para iniciar sesión."
              : "Los menores se crean sin email y no pueden iniciar sesión."}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {member && <input type="hidden" name="id" value={member.id} />}
          <input type="hidden" name="color" value={color} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="display_name">Nombre</Label>
            <Input
              id="display_name"
              name="display_name"
              defaultValue={member?.display_name}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "adulto" | "menor")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="adulto">Adulto</SelectItem>
                <SelectItem value="menor">Menor</SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" name="role" value={role} />
          </div>

          {role === "adulto" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email (opcional)</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={member?.email ?? ""}
              />
              <p className="text-xs text-muted-foreground">
                Si cargás un email, esa persona debe registrarse con este
                mismo email en /registro para acceder a esta familia.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="size-7 rounded-full ring-offset-2 transition-shadow"
                  style={{
                    backgroundColor: c,
                    boxShadow: color === c ? `0 0 0 2px ${c}` : undefined,
                  }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>

          {role === "adulto" && (
            <div className="flex items-center justify-between">
              <Label htmlFor="can_login">Puede iniciar sesión</Label>
              <Switch
                id="can_login"
                name="can_login"
                defaultChecked={member?.can_login ?? true}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
