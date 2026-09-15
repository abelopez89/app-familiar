import { redirect } from "next/navigation";
import { getCurrentFamilyContext } from "@/lib/family";
import { getTelegramBotUsername } from "@/lib/telegram";
import { TelegramLinkCard } from "./telegram-link-card";

export default async function ConfigTelegramPage() {
  const context = await getCurrentFamilyContext();
  if (!context) redirect("/login");

  const botUsername = await getTelegramBotUsername();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Telegram</h1>
      <TelegramLinkCard
        botUsername={botUsername}
        isLinked={context.member.telegram_user_id !== null}
      />
    </div>
  );
}
