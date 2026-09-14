"use client";

import { Suspense, useActionState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { login, type ActionState } from "../actions";
import { GoogleSignInButton } from "../google-sign-in-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "";
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    login,
    undefined,
  );

  useEffect(() => {
    if (searchParams.get("error") === "google") {
      toast.error("No se pudo iniciar sesión con Google.");
    }
  }, [searchParams]);

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="redirect" value={redirectTo} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending} className="mt-2">
          {pending ? "Ingresando…" : "Ingresar"}
        </Button>
        <div className="flex justify-between text-sm text-muted-foreground">
          <Link href="/recuperar" className="hover:underline">
            Olvidé mi contraseña
          </Link>
          <Link href="/registro" className="hover:underline">
            Crear cuenta
          </Link>
        </div>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        O
        <div className="h-px flex-1 bg-border" />
      </div>

      <GoogleSignInButton />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Iniciar sesión</CardTitle>
        <CardDescription>Entrá con el email y contraseña de tu familia.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
