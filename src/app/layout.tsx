import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
