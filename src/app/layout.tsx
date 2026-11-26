import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { connection } from "next/server";
import "@fontsource-variable/newsreader";
import "@fontsource-variable/instrument-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "IGREJAQUA", template: "%s · IGREJAQUA" },
  description: "Gestão de igreja, ministérios, escalas e repertório.",
  applicationName: "IGREJAQUA",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#F4EFE4",
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
      <body>{children}</body>
    </html>
  );
}
