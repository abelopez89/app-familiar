function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Configurala en el proyecto de Vercel (Settings → Environment Variables) y volvé a desplegar.`,
    );
  }
  return value;
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  NEXT_PUBLIC_APP_URL: required("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL),
};

export function getServiceRoleKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getTelegramBotToken(): string {
  return required("TELEGRAM_BOT_TOKEN", process.env.TELEGRAM_BOT_TOKEN);
}

export function getTelegramWebhookSecret(): string {
  return required("TELEGRAM_WEBHOOK_SECRET", process.env.TELEGRAM_WEBHOOK_SECRET);
}

export function getCronSecret(): string {
  return required("CRON_SECRET", process.env.CRON_SECRET);
}
