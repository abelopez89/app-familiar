"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Plus, Star } from "lucide-react";
import type { ShoppingTemplate } from "@/lib/supabase/types";
import {
  createTemplate,
  duplicateTemplate,
  setDefaultTemplate,
  toggleTemplateActive,
  type ActionResult,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export function TemplatesList({
  templates,
  itemCounts,
}: {
  templates: ShoppingTemplate[];
  itemCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(
    createTemplate,
    {},
  );

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.success) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  function handleSetDefault(id: string) {
    startTransition(async () => {
      const result = await setDefaultTemplate(id);
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  }

  function handleToggleActive(id: string, isActive: boolean) {
    startTransition(async () => {
      const result = await toggleTemplateActive(id, isActive);
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  }

  function handleDuplicate(id: string) {
    startTransition(async () => {
      const result = await duplicateTemplate(id);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Plantilla duplicada.");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2 self-start">
            <Plus className="size-4" />
            Nueva plantilla
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva plantilla</DialogTitle>
          </DialogHeader>
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Input id="description" name="description" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Creando…" : "Crear"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay plantillas todavía.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {templates.map((template) => (
            <Card key={template.id} className={!template.is_active ? "opacity-60" : undefined}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/compras/plantillas/${template.id}`} className="flex-1">
                    <p className="font-medium">{template.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {itemCounts[template.id] ?? 0} productos
                      {template.description ? ` · ${template.description}` : ""}
                    </p>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleSetDefault(template.id)}
                    aria-label="Marcar como plantilla por defecto"
                  >
                    <Star
                      className={
                        template.is_default
                          ? "size-5 fill-amber-400 text-amber-400"
                          : "size-5 text-muted-foreground"
                      }
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    onClick={() => handleDuplicate(template.id)}
                  >
                    <Copy className="size-4" />
                    Duplicar
                  </Button>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`active-${template.id}`} className="text-sm text-muted-foreground">
                      Activa
                    </Label>
                    <Switch
                      id={`active-${template.id}`}
                      checked={template.is_active}
                      onCheckedChange={(checked) => handleToggleActive(template.id, checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
