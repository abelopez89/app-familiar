"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { updateDocument, type ActionResult } from "../actions";
import { DOCUMENT_TYPES } from "@/lib/documents/constants";
import type { DocumentCategory, FamilyMember } from "@/lib/supabase/types";
import type { DocumentWithFiles } from "@/lib/documents/queries";
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

export function EditDocumentDialog({
  document,
  categories,
  members,
}: {
  document: DocumentWithFiles;
  categories: DocumentCategory[];
  members: FamilyMember[];
}) {
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState(document.member_id ?? "");
  const [categoryId, setCategoryId] = useState(document.category_id ?? "");
  const [docType, setDocType] = useState(document.doc_type ?? "");

  const [state, formAction, pending] = useActionState<ActionResult, FormData>(updateDocument, {});

  useEffect(() => {
    if (state.success) {
      toast.success("Documento actualizado.");
      setOpen(false);
    }
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Editar</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar documento</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={document.id} />
          <input type="hidden" name="member_id" value={memberId} />
          <input type="hidden" name="category_id" value={categoryId} />
          <input type="hidden" name="doc_type" value={docType} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Título</Label>
            <Input id="title" name="title" defaultValue={document.title} required />
          </div>

          <div className="flex flex-col gap-2">
            <Label>De quién es</Label>
            <Select value={memberId || "familia"} onValueChange={(v) => setMemberId(v === "familia" ? "" : v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="familia">De la familia</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Tipo (opcional)</Label>
            <Select value={docType || "ninguno"} onValueChange={(v) => setDocType(v === "ninguno" ? "" : v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguno">Sin especificar</SelectItem>
                {DOCUMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Categoría (opcional)</Label>
            <Select value={categoryId || "ninguna"} onValueChange={(v) => setCategoryId(v === "ninguna" ? "" : v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguna">Sin categoría</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="issued_at">Emitido (opcional)</Label>
              <Input id="issued_at" name="issued_at" type="date" defaultValue={document.issued_at ?? ""} />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="expires_at">Vence (opcional)</Label>
              <Input id="expires_at" name="expires_at" type="date" defaultValue={document.expires_at ?? ""} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="expiry_lead_days">Avisar con anticipación (días)</Label>
            <Input
              id="expiry_lead_days"
              name="expiry_lead_days"
              type="number"
              min="0"
              defaultValue={document.expiry_lead_days}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tags">Tags (separados por coma, opcional)</Label>
            <Input id="tags" name="tags" defaultValue={(document.tags ?? []).join(", ")} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea id="notes" name="notes" defaultValue={document.notes ?? ""} />
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
