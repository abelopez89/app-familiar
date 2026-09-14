"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRightLeft } from "lucide-react";
import type { ShoppingTemplate } from "@/lib/supabase/types";
import { moveOrCopyTemplateItem } from "../actions";
import { Button } from "@/components/ui/button";
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

export function MoveCopyDialog({
  itemId,
  otherTemplates,
}: {
  itemId: string;
  otherTemplates: ShoppingTemplate[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string>(otherTemplates[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();

  function handle(mode: "move" | "copy") {
    if (!target) return;
    startTransition(async () => {
      const result = await moveOrCopyTemplateItem(itemId, target, mode);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(mode === "move" ? "Producto movido." : "Producto copiado.");
      setOpen(false);
      router.refresh();
    });
  }

  if (otherTemplates.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Mover o copiar a otra plantilla">
          <ArrowRightLeft className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover o copiar a otra plantilla</DialogTitle>
        </DialogHeader>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {otherTemplates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={isPending} onClick={() => handle("copy")}>
            Copiar
          </Button>
          <Button disabled={isPending} onClick={() => handle("move")}>
            Mover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
