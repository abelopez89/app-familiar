import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Bricolage_Grotesque } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { RegisterServiceWorker } from "@/components/register-service-worker";
import "./globals.css";

// Texto corrido: pensada para leerse bien en pantallas chicas y con mala
// luz (en el súper, en la estación). Solo tiene 400 y 700.
const bodyFont = Atkinson_Hyperlegible({
  variable: "--font-body",
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

// Títulos y números grandes (ver `h1, h2, h3` en globals.css).
const displayFont = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "App Familiar",
  description: "Organizá la vida doméstica de tu familia",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    // `black-translucent` es lo que deja que el header de vidrio se vea
    // por debajo de la barra de estado en iOS; el padding lo pone
    // `--safe-top` en el header, no el sistema.
    statusBarStyle: "black-translucent",
    title: "App Familiar",
  },
  formatDetection: {
    // Safari convierte cantidades y precios en guaraníes en links de
    // teléfono si no se desactiva.
    telephone: false,
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#17211c" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Sin esto la app no dibuja debajo del notch ni del indicador de
  // inicio del iPhone, y `env(safe-area-inset-*)` devuelve siempre 0.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${bodyFont.variable} ${displayFont.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background">
        {children}
        <Toaster position="top-center" richColors closeButton />
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
