import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Área sem valor de busca: fora do índice (o proxy também envia X-Robots-Tag). */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Layout do Stage Mode: sem navegação, tema escuro de alto contraste (UX_DESIGN §6). */
export default function StageLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-palco text-palco-txt">{children}</div>;
}
