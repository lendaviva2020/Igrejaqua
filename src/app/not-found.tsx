import type { Metadata } from "next";
import Link from "next/link";
import { BrandName, Logo } from "@/components/shared/logo";

export const metadata: Metadata = { title: "Página não encontrada", robots: { index: false, follow: true } };

/** 404 real (status HTTP 404): sem redirecionar para a home, para não criar "soft 404". */
export default function NotFound() {
  return (
    <main id="conteudo" className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-fundo px-6 text-center text-texto">
      <Link href="/" className="flex items-center gap-3" aria-label="IGREJAQUA, página inicial">
        <Logo size={40} decorative />
        <BrandName className="text-xl" />
      </Link>
      <h1 className="text-3xl">Página não encontrada</h1>
      <p className="max-w-sm text-texto-2">O endereço pode ter mudado ou não existir. Confira o link ou volte para um caminho conhecido.</p>
      <nav aria-label="Caminhos" className="flex flex-col gap-3 sm:flex-row">
        <Link href="/" className="inline-flex min-h-12 items-center justify-center rounded-full bg-ambar px-7 text-sm font-semibold text-sobre-ambar transition hover:bg-ambar-claro">Página inicial</Link>
        <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-full border border-borda px-7 text-sm font-semibold text-texto transition hover:border-ambar">Entrar</Link>
      </nav>
    </main>
  );
}
