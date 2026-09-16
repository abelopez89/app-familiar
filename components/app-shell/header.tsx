import Link from "next/link";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackButton } from "./back-button";

export function AppHeader({ familyName }: { familyName: string }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-lg items-center justify-between px-2 py-2">
        <div className="flex items-center gap-1">
          <BackButton />
          <Link href="/" className="px-2 font-semibold">
            {familyName}
          </Link>
        </div>
        <Button variant="ghost" size="icon" asChild>
          <Link href="/config/familia" aria-label="Configuración">
            <Settings className="size-5" />
          </Link>
        </Button>
      </div>
    </header>
  );
}
