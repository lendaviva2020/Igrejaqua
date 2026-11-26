import type { ReactNode } from "react";

/** Layout do Stage Mode: sem navegação, tema escuro de alto contraste (UX_DESIGN §6). */
export default function StageLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-palco text-palco-txt">{children}</div>;
}
