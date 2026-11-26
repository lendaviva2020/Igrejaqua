import type { Metadata } from "next";
import { Logo } from "@/components/shared/logo";

export const metadata: Metadata = { title: "Sem conexão" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-fundo px-6 text-center text-texto">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-ambar text-sobre-ambar"><Logo size={32} /></span>
      <h1 className="text-2xl">Sem conexão no momento</h1>
      <p className="max-w-sm text-texto-2">Esta página precisa de internet. O Modo Palco que você já abriu continua disponível neste aparelho.</p>
      <a href="/dashboard" className="inline-flex min-h-12 items-center rounded-full bg-ambar px-7 text-sm font-semibold text-sobre-ambar">Tentar novamente</a>
    </main>
  );
}
