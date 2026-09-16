import { redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { getTelegramBotUsername } from "@/lib/telegram";
import { TelegramLinkCard } from "./telegram-link-card";
import { PageHeader } from "@/components/app-shell/page-header";

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
    </div>
  );
}
