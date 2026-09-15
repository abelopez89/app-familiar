"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, Send } from "lucide-react";
import { generateTelegramLinkCode, unlinkTelegram } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function useCountdown(expiresAt: string | null) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setRemaining(null);
      return;
    }
    const target = new Date(expiresAt).getTime();
    const tick = () => setRemaining(Math.max(0, Math.round((target - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return remaining;
}

export function TelegramLinkCard({
  botUsername,
  isLinked: initialIsLinked,
}: {
  botUsername: string | null;
  isLinked: boolean;
}) {
  const [isLinked, setIsLinked] = useState(initialIsLinked);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const remaining = useCountdown(expiresAt);

  useEffect(() => {
    if (remaining === 0) {
      setCode(null);
      setExpiresAt(null);
    }
  }, [remaining]);

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateTelegramLinkCode();
      if (result.error || !result.code) {
        toast.error(result.error ?? "No se pudo generar el código.");
        return;
      }
      setCode(result.code);
      setExpiresAt(result.expiresAt ?? null);
    });
  }

  function handleUnlink() {
    startTransition(async () => {
      const result = await unlinkTelegram();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setIsLinked(false);
      toast.success("Cuenta de Telegram desvinculada.");
    });
  }

  if (isLinked) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-green-600" />
            Cuenta vinculada
          </CardTitle>
          <CardDescription>
            Vas a recibir por Telegram los recordatorios que marques con la
            opción &quot;Avisar también por Telegram&quot; al crear un evento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleUnlink} disabled={isPending}>
            {isPending ? "Desvinculando…" : "Desvincular"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="size-5" />
          Vincular Telegram
        </CardTitle>
        <CardDescription>
          Recibí los recordatorios de tus eventos por Telegram, además del
          calendario.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {code ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/40 py-6">
            <span className="text-3xl font-bold tracking-widest">{code}</span>
            <span className="text-xs text-muted-foreground">
              Vence en {remaining !== null ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}` : "…"}
            </span>
          </div>
        ) : (
          <Button onClick={handleGenerate} disabled={isPending}>
            {isPending ? "Generando…" : "Generar código"}
          </Button>
        )}

        {code && (
          <ol className="list-inside list-decimal space-y-1.5 text-sm text-muted-foreground">
            <li>
              Abrí Telegram y buscá{" "}
              {botUsername ? (
                <a
                  href={`https://t.me/${botUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline"
                >
                  @{botUsername}
                </a>
              ) : (
                "el bot de la familia"
              )}
              .
            </li>
            <li>
              Mandale <code className="rounded bg-muted px-1">/vincular {code}</code>.
            </li>
            <li>Te va a confirmar por acá cuando quede vinculado.</li>
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
