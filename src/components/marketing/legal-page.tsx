import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Logo } from "@/components/shared/logo";
import { siteConfig } from "@/lib/site";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <>
      <header className="mx-auto flex max-w-3xl items-center px-6 py-5">
        <Link href="/" className="flex items-center gap-2 text-ambar" aria-label="IGREJAQUA, página inicial"><Logo size={28} /><span className="text-lg font-bold tracking-wide text-texto">IGREJAQUA</span></Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-16 pt-6">
        <h1 className="text-3xl md:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-texto-2">Última atualização: {updated}</p>
        <div className="mt-8 flex flex-col gap-4 [&_h2]:mt-6 [&_h2]:text-2xl [&_li]:ml-5 [&_li]:list-disc [&_p]:text-texto-2 [&_li]:text-texto-2 [&_a]:text-ambar-claro [&_a]:underline">{children}</div>
      </main>
      <SiteFooter site={siteConfig()} />
    </>
  );
}

export function ContactLine() {
  const { contactEmail } = siteConfig();
  return contactEmail ? <p>Para exercer seus direitos ou tirar dúvidas, escreva para <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p> : <p>Para exercer seus direitos ou tirar dúvidas, fale com a liderança da sua igreja, que é a responsável pelos dados.</p>;
}
