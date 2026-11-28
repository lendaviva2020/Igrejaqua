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
import { WebVitalsReporter } from "@/components/perf/web-vitals-reporter";
import { siteOrigin } from "@/lib/seo/routes";

const DESCRIPTION = "Gestão de igreja, ministérios, escalas e repertório.";

/**
 * Padrões herdados por todas as páginas. A canônica NÃO é definida aqui (seria herdada por páginas
 * privadas): cada página pública declara a sua. Os grupos privados declaram `noindex` no próprio layout.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: { default: "IGREJAQUA", template: "%s · IGREJAQUA" },
  description: DESCRIPTION,
  applicationName: "IGREJAQUA",
  openGraph: { type: "website", locale: "pt_BR", siteName: "IGREJAQUA", description: DESCRIPTION, images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "Emblema do IGREJAQUA" }] },
  twitter: { card: "summary" },
  formatDetection: { telephone: false, email: false, address: false },
  manifest: "/manifest.json",
  icons: { icon: [{ url: "/favicon.ico", sizes: "48x48" }, { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" }], apple: "/icons/apple-touch-icon.png" },
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
        <WebVitalsReporter />
      </body>
    </html>
  );
}
