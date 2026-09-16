"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { MoreVertical } from "lucide-react";
import type { FamilyMember } from "@/lib/supabase/types";
import { deactivateMember } from "../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MemberFormDialog } from "./member-form-dialog";

export function MembersList({ members }: { members: FamilyMember[] }) {
  const [items, setItems] = useState(members);
  const [isPending, startTransition] = useTransition();

  function handleDeactivate(id: string) {
    startTransition(async () => {
      const result = await deactivateMember(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setItems((prev) => prev.filter((m) => m.id !== id));
      toast.success("Miembro dado de baja.");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <MemberFormDialog />
      </div>

      <Card>
        <CardContent className="flex flex-col divide-y p-0">
          {items.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              No hay miembros todavía.
            </p>
          )}
          {items.map((member) => (
            <div key={member.id} className="flex items-center gap-3 p-4">
              <Link href={`/config/miembros/${member.id}`} className="flex flex-1 items-center gap-3">
                <span
                  className="size-9 shrink-0 rounded-full"
                  style={{ backgroundColor: member.color }}
                />
                <div className="flex flex-1 flex-col">
                  <span className="font-medium">{member.display_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {member.email ?? "Sin email"}
                  </span>
                </div>
              </Link>
              <Badge variant={member.role === "adulto" ? "secondary" : "outline"}>
                {member.role === "adulto" ? "Adulto" : "Menor"}
              </Badge>
              {!member.can_login && (
                <Badge variant="outline">Sin acceso</Badge>
              )}
              <MemberFormDialog member={member} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={isPending}
                    onClick={() => handleDeactivate(member.id)}
                  >
                    Dar de baja
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
