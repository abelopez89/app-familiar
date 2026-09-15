"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";
import { rotateCalendarToken } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CalendarLinkCard({ feedUrl: initialFeedUrl }: { feedUrl: string }) {
  const [feedUrl, setFeedUrl] = useState(initialFeedUrl);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(feedUrl);
      toast.success("Link copiado.");
    } catch {
      toast.error("No se pudo copiar. Copialo a mano.");
    }
  }

  function handleRotate() {
    startTransition(async () => {
      const result = await rotateCalendarToken();
      if (result.error || !result.token) {
        toast.error(result.error ?? "No se pudo rotar el token.");
        return;
      }
      const base = feedUrl.slice(0, feedUrl.lastIndexOf("/") + 1);
      setFeedUrl(`${base}${result.token}`);
      setRotateOpen(false);
      toast.success("Token rotado. El link anterior dejó de funcionar.");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Tu link de calendario</CardTitle>
          <CardDescription>
            Cualquiera que tenga este link puede ver todos los eventos de tu
            familia. No lo compartas fuera de tu familia.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input readOnly value={feedUrl} className="text-xs" />
            <Button type="button" size="icon" variant="outline" onClick={handleCopy}>
              <Copy className="size-4" />
            </Button>
          </div>

          <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" className="gap-2">
                <RefreshCw className="size-4" />
                Rotar token
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>¿Rotar el token del calendario?</DialogTitle>
                <DialogDescription>
                  Se genera un link nuevo y el anterior deja de funcionar de
                  inmediato. Vas a tener que volver a suscribirte en cada
                  dispositivo con el link nuevo.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setRotateOpen(false)}
                  disabled={isPending}
                >
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleRotate} disabled={isPending}>
                  {isPending ? "Rotando…" : "Rotar token"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suscribirse desde iPhone (Apple Calendar)</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-inside list-decimal space-y-1.5 text-sm text-muted-foreground">
            <li>Copiá el link de arriba.</li>
            <li>Abrí Ajustes → Calendario → Cuentas → Añadir cuenta.</li>
            <li>Elegí &quot;Otra&quot; → &quot;Añadir calendario suscrito&quot;.</li>
            <li>Pegá el link en &quot;Servidor&quot; y guardá.</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suscribirse desde Google Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-inside list-decimal space-y-1.5 text-sm text-muted-foreground">
            <li>Copiá el link de arriba.</li>
            <li>
              En Google Calendar (desde una compu), andá a &quot;Otros
              calendarios&quot; → el &quot;+&quot; → &quot;Desde URL&quot;.
            </li>
            <li>Pegá el link y tocá &quot;Añadir calendario&quot;.</li>
            <li>
              Puede tardar hasta 24 horas en sincronizar por primera vez —
              es una limitación de Google, no de la app.
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
