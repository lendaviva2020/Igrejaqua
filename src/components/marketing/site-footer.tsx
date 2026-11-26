import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import type { SiteConfig } from "@/lib/site";
import { SocialIcon } from "./social-icons";

export function SiteFooter({ site }: { site: SiteConfig }) {
  return (
    <footer className="border-t border-linha">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10 md:flex-row md:items-start md:justify-between">
        <div className="flex max-w-xs flex-col gap-3">
          <div className="flex items-center gap-2 text-ambar"><Logo size={28} /><span className="text-lg font-bold tracking-wide text-texto">IGREJAQUA</span></div>
          <p className="text-sm text-texto-2">{site.churchName ? `Sistema de gestão usado por ${site.churchName}.` : "Sistema de gestão para a vida da igreja."}</p>
          {site.contactEmail ? <a className="text-sm text-ambar-claro underline" href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a> : null}
        </div>
        <div className="flex flex-col gap-6 sm:flex-row sm:gap-16">
          <nav aria-label="Rodapé" className="flex flex-col gap-1 text-sm">
            <Link className="inline-flex min-h-8 items-center hover:text-ambar-claro" href="/login">Entrar</Link>
            <Link className="inline-flex min-h-8 items-center hover:text-ambar-claro" href="/cadastro">Criar conta</Link>
            <Link className="inline-flex min-h-8 items-center hover:text-ambar-claro" href="/privacidade">Política de Privacidade</Link>
            <Link className="inline-flex min-h-8 items-center hover:text-ambar-claro" href="/termos">Termos de Uso</Link>
          </nav>
          {site.socials.length > 0 ? (
            <nav aria-label="Redes sociais">
              <ul className="flex gap-1">
                {site.socials.map((s) => (
                  <li key={s.network}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`${s.label} (abre em nova aba)`} className="inline-flex size-11 items-center justify-center rounded-full border border-linha text-texto-2 transition-colors hover:border-ambar hover:text-ambar-claro">
                      <SocialIcon network={s.network} />
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
