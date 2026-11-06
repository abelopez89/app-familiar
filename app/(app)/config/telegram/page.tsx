import { redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { getTelegramBotUsername } from "@/lib/telegram/client";
import { TelegramLinkCard } from "./telegram-link-card";
import { PageHeader, SectionTitle } from "@/components/app-shell/page-header";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Lo que se puede hacer desde el chat, para que se sepa sin probar. Varias
 * cosas son más rápidas por el bot que por la app (auditoría de flujos):
 * marcar una tarea hecha desde el aviso, ver la semana, cargar un evento en
 * un solo mensaje. Es la misma lista que el menú registrado con
 * `setMyCommands` (ver "Configuración operativa" en CLAUDE.md): si se
 * agrega un comando, va en los dos lados.
 */
const COMANDOS: Array<[comando: string, descripcion: string]> = [
  ["/menu", "Todas las opciones con botones"],
  ["/hoy", "Eventos de hoy y mañana, lista abierta y tus balances"],
  ["/semana", "Eventos de hoy y los 6 días siguientes"],
  ["/compra", "Ver la lista abierta, tildar y agregar productos"],
  ["/gasto", "Cargar un gasto: \"45000 cena\" y dos toques"],
  ["/nafta", "Cargar combustible"],
  ["/evento", "Un evento en un mensaje: \"Dentista jueves 15:30\""],
  ["/cancelar", "Cortar lo que estabas cargando"],
];

export default async function ConfigTelegramPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const botUsername = await getTelegramBotUsername();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Telegram" description="Recordatorios y vencimientos por chat" />
      <TelegramLinkCard
        botUsername={botUsername}
        isLinked={context.member.telegram_user_id !== null}
      />

      <div className="flex flex-col gap-2">
        <SectionTitle>Qué podés hacer desde el chat</SectionTitle>
        <Card>
          <CardContent className="flex flex-col divide-y p-0 text-sm">
            {COMANDOS.map(([comando, descripcion]) => (
              <div key={comando} className="flex gap-3 px-4 py-2.5">
                <span className="w-20 shrink-0 font-mono font-medium">{comando}</span>
                <span className="text-muted-foreground">{descripcion}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <p className="px-1 text-xs text-muted-foreground">
          Los avisos también traen botones: &ldquo;✓ Hecha&rdquo; en las tareas y &ldquo;Ver agenda del día&rdquo; en los
          recordatorios de eventos.
        </p>
      </div>
    </div>
  );
}
