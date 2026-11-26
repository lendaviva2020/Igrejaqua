import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { connection } from "next/server";
import "@fontsource-variable/merriweather/wght.css";
import "@fontsource-variable/merriweather/wght-italic.css";
import "@fontsource-variable/source-sans-3/wght.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

export const metadata: Metadata = {
  title: { default: "IGREJAQUA", template: "%s · IGREJAQUA" },
  description: "Gestão de igreja, ministérios, escalas e repertório.",
  applicationName: "IGREJAQUA",
  manifest: "/manifest.json",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0F1420",
  width: "device-width",
  initialScale: 1,
};

/**
 * Renderização dinâmica obrigatória: a CSP usa nonce por requisição (src/proxy.ts), e páginas
 * pré-renderizadas não recebem nonce — seus scripts seriam bloqueados pelo navegador.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection();
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
