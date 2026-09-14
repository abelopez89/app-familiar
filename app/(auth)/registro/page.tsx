"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup, type ActionState } from "../actions";
import { GoogleSignInButton } from "../google-sign-in-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegistroPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    signup,
    undefined,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Crear cuenta</CardTitle>
        <CardDescription>
          Si un adulto de tu familia ya te dio de alta con este email desde
          Configuración → Miembros, vas a quedar vinculado a esa familia
          automáticamente. Si no, se crea una familia nueva.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form action={formAction} className="flex flex-col gap-4">
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
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending} className="mt-2">
            {pending ? "Creando cuenta…" : "Crear cuenta"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tenés cuenta?{" "}
            <Link href="/login" className="hover:underline">
              Iniciá sesión
            </Link>
          </p>
        </form>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          O
          <div className="h-px flex-1 bg-border" />
        </div>

        <GoogleSignInButton />
      </CardContent>
    </Card>
  );
}
