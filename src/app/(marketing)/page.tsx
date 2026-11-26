import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { buttonClasses } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="brilho-ambar mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      <div className="flex flex-col items-center gap-4">
        <Logo size={88} className="text-ambar" />
        <h1 className="text-5xl font-bold tracking-wide">IGREJAQUA</h1>
        <p className="max-w-xs text-lg text-texto-2">Gestão de igreja, ministérios, escalas e repertório para equipes de culto.</p>
      </div>
      <div className="flex w-full flex-col gap-3">
        <Link href="/login" className={buttonClasses("primary", "min-h-12 text-base")}>Entrar</Link>
        <Link href="/cadastro" className={buttonClasses("secondary", "min-h-12 text-base")}>Criar conta</Link>
      </div>
    </main>
  );
}
