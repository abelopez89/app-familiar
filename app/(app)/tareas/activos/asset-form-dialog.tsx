"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createAsset, updateAsset, type ActionResult } from "./actions";
import { ASSET_TYPES } from "@/lib/tasks/constants";
import type { Asset, AssetType, FamilyDocument } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AssetFormDialog({
  asset,
  documents = [],
  trigger,
}: {
  asset?: Asset;
  documents?: FamilyDocument[];
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [documentId, setDocumentId] = useState(asset?.document_id ?? "");
  const action = asset ? updateAsset : createAsset;
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(action, {});

  useEffect(() => {
    if (state.success) {
      toast.success(asset ? "Activo actualizado." : "Activo creado.");
      setOpen(false);
    }
    if (state.error) toast.error(state.error);
  }, [state, asset]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="icon" className="size-14 rounded-full shadow-lg">
            <Plus className="size-6" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{asset ? "Editar activo" : "Nuevo activo"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {asset && <input type="hidden" name="id" value={asset.id} />}

          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" defaultValue={asset?.name} required />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Tipo</Label>
            <Select name="asset_type" defaultValue={asset?.asset_type ?? "electrodomestico"}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ASSET_TYPES) as AssetType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    {ASSET_TYPES[type].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="brand">Marca (opcional)</Label>
              <Input id="brand" name="brand" defaultValue={asset?.brand ?? ""} />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="model">Modelo (opcional)</Label>
              <Input id="model" name="model" defaultValue={asset?.model ?? ""} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="location">Ubicación (opcional)</Label>
            <Input id="location" name="location" defaultValue={asset?.location ?? ""} />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="purchased_at">Fecha de compra (opcional)</Label>
              <Input id="purchased_at" name="purchased_at" type="date" defaultValue={asset?.purchased_at ?? ""} />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="warranty_until">Garantía hasta (opcional)</Label>
              <Input id="warranty_until" name="warranty_until" type="date" defaultValue={asset?.warranty_until ?? ""} />
            </div>
          </div>

          {documents.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>Manual o factura vinculado (opcional)</Label>
              <Select value={documentId || "ninguno"} onValueChange={(v) => setDocumentId(v === "ninguno" ? "" : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguno">Ninguno</SelectItem>
                  {documents.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      {doc.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="document_id" value={documentId} />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea id="notes" name="notes" defaultValue={asset?.notes ?? ""} />
          </div>

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
