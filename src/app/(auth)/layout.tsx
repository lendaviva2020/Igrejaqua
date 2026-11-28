import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LogoFull } from "@/components/shared/logo";

/** Área sem valor de busca: fora do índice (o proxy também envia X-Robots-Tag). */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 flex justify-center">
        <LogoFull width={220} />
      </div>
      <div className="rounded-superficie border border-linha bg-superficie p-6">{children}</div>
    </main>
  );
}
