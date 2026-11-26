import type { ReactNode } from "react";
import { Logo } from "@/components/shared/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 flex items-center gap-3 text-ambar">
        <Logo size={44} />
        <p className="text-3xl font-bold tracking-wide text-texto">IGREJAQUA</p>
      </div>
      <div className="rounded-superficie border border-linha bg-superficie p-6">{children}</div>
    </main>
  );
}
