import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarCheck, Check, CheckCircle2, ChevronRight, HandHeart, Heart, Music2, ShieldCheck, UsersRound, Users } from "lucide-react";
import type { ReactNode } from "react";
import { DashboardPreview, StagePreview } from "@/components/marketing/landing-previews";
import { SocialIcon } from "@/components/marketing/social-icons";
import { BrandName, Logo } from "@/components/shared/logo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = { title: "Organização que aproxima", description: "Ministérios, escalas, cultos, ensaios e louvor da sua igreja em um só lugar." };

const FEATURES = [
  { icon: UsersRound, title: "Pessoas e ministérios", description: "Organize membros, equipes, funções e lideranças em um só lugar. Cada pessoa sabe onde serve e com quem pode contar." },
  { icon: CalendarCheck, title: "Escalas sem confusão", description: "Monte escalas considerando disponibilidade, funções e participação. Envie convites e acompanhe as confirmações." },
  { icon: Music2, title: "Louvor organizado", description: "Centralize repertório, cifras, tons e setlists. A equipe chega ao ensaio sabendo o que tocar." },
  { icon: Heart, title: "Comunidade conectada", description: "Compartilhe avisos, devocionais e pedidos de oração, inclusive anônimos. A igreja fica próxima também durante a semana." },
] as const;

const STEPS = [
  { title: "Organize sua igreja", description: "Cadastre ministérios e convide as pessoas. Cada uma recebe acesso de acordo com a sua função." },
  { title: "Planeje a semana", description: "Crie cultos, ensaios e eventos. Organize equipes, horários, repertórios e disponibilidades." },
  { title: "Caminhe em unidade", description: "Todos acompanham suas escalas, recebem avisos e sabem o que precisa ser feito." },
] as const;

const STAGE_POINTS = ["Repertório centralizado e organizado", "Cifras com troca de tom na hora", "Setlist preparado para cada celebração", "Modo Palco com leitura confortável"] as const;
const AI_STEPS = ["A inteligência artificial sugere", "A liderança revisa e ajusta", "Só então é publicado"] as const;

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="h-px w-8 bg-ambar" aria-hidden="true" />
      <span className="text-xs font-semibold uppercase tracking-[2px] text-ambar-claro">{children}</span>
    </div>
  );
}

export default function HomePage() {
  const site = siteConfig();
  const year = new Date().getFullYear();
  return (
    <div className="min-h-dvh overflow-x-clip bg-fundo text-texto">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-ambar focus:p-3 focus:text-sobre-ambar">Pular para o conteúdo</a>

      <header className="sticky top-0 z-50 border-b border-linha bg-fundo/90 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="IGREJAQUA, início">
            <Logo size={34} decorative />
            <BrandName className="text-[19px]" />
          </Link>
          <nav aria-label="Principal" className="hidden items-center gap-8 md:flex">
            {[["#plataforma", "Plataforma"], ["#louvor", "Louvor"], ["#como-funciona", "Como funciona"], ["#comecar", "Começar"]].map(([href, label]) => (
              <a key={href} href={href} className="text-sm text-texto-2 transition hover:text-texto">{label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-texto-2 transition hover:text-texto">Entrar</Link>
            <Link href="/cadastro" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ambar px-5 text-sm font-semibold text-sobre-ambar transition hover:bg-ambar-claro">Criar conta<ArrowUpRight size={14} aria-hidden="true" /></Link>
          </div>
        </div>
      </header>

      <main id="conteudo">
        <section className="relative px-5 pb-24 pt-16 sm:px-8 sm:pt-24 lg:pb-32 lg:pt-28">
          <div aria-hidden="true" className="pointer-events-none absolute -right-40 top-0 size-[600px] rounded-full bg-ambar/15 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="max-w-xl">
              <SectionLabel>Organização que aproxima</SectionLabel>
              <h1 className="text-[36px] leading-[1.18] sm:text-[46px] lg:text-[50px]">
                Uma igreja conectada começa com <span className="italic text-ambar-claro">pessoas unidas.</span>
              </h1>
              <p className="mt-7 max-w-lg text-base leading-7 text-texto-2 sm:text-[17px]">
                Organize ministérios, escalas, cultos, ensaios e louvor em um só lugar. Menos desencontro na organização, mais tempo para cuidar de pessoas e servir com propósito.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/cadastro" className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-ambar px-7 text-sm font-semibold text-sobre-ambar transition hover:bg-ambar-claro">Criar conta da igreja<ArrowRight size={16} aria-hidden="true" /></Link>
                <a href="#plataforma" className="inline-flex min-h-12 items-center justify-center rounded-full border border-borda bg-superficie px-7 text-sm font-semibold text-texto transition hover:border-ambar">Explorar recursos</a>
              </div>
              <ul className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-linha pt-6 text-sm text-texto-2">
                <li className="flex items-center gap-2"><ShieldCheck size={16} className="text-ambar-claro" aria-hidden="true" />Acesso organizado por função</li>
                <li className="flex items-center gap-2"><Users size={16} className="text-ambar-claro" aria-hidden="true" />Feito para comunidades</li>
              </ul>
            </div>
            <DashboardPreview churchName={site.churchName ?? "Sua igreja"} />
          </div>
        </section>

        <section aria-label="Posicionamento" className="border-y border-linha bg-superficie px-5 py-7 sm:px-8">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 text-center md:flex-row md:text-left">
            <p className="max-w-md text-sm font-medium leading-6 text-texto-2">A organização acontece nos bastidores. O cuidado com as pessoas continua sendo o centro.</p>
            <ul className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-xs font-semibold uppercase tracking-[1.4px] text-texto-2">
              {["Ministérios", "Agenda", "Louvor", "Comunidade"].map((t) => <li key={t} className="flex items-center gap-7 first:before:hidden before:size-1 before:rounded-full before:bg-ambar before:content-['']">{t}</li>)}
            </ul>
          </div>
        </section>

        <section id="plataforma" aria-labelledby="plataforma-titulo" className="scroll-mt-20 px-5 py-24 sm:px-8 lg:py-28">
          <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <SectionLabel>Uma plataforma para servir melhor</SectionLabel>
              <h2 id="plataforma-titulo" className="max-w-lg text-[28px] leading-[1.25] sm:text-[34px]">Tudo que sua igreja precisa para caminhar em unidade.</h2>
              <p className="mt-6 max-w-md text-[15px] leading-7 text-texto-2">Informações espalhadas em conversas, planilhas e anotações dificultam a rotina. O IGREJAQUA reúne a organização da igreja em um ambiente simples, claro e acessível.</p>
              <a href="#louvor" className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ambar-claro hover:text-texto">Conheça o louvor<ChevronRight size={16} aria-hidden="true" /></a>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <article key={title} className="group rounded-2xl border border-linha bg-superficie p-6 transition duration-300 hover:-translate-y-1 hover:border-ambar">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-superficie-2 text-ambar-claro transition group-hover:bg-ambar group-hover:text-sobre-ambar"><Icon size={20} strokeWidth={1.7} aria-hidden="true" /></span>
                  <h3 className="mt-7 text-[17px]">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-texto-2">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="louvor" aria-labelledby="louvor-titulo" className="scroll-mt-20 border-y border-linha bg-superficie px-5 py-24 text-texto sm:px-8 lg:py-28">
          <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2">
            <div>
              <SectionLabel>Um cuidado especial com o louvor</SectionLabel>
              <h2 id="louvor-titulo" className="max-w-xl text-[28px] leading-[1.25] sm:text-[36px]">O ensaio começa antes de a equipe chegar.</h2>
              <p className="mt-6 max-w-lg text-[15px] leading-7 text-texto-2">Repertório, cifras, tons e setlists reunidos em um ambiente pensado para músicos e equipes de louvor. Mais clareza na preparação e tranquilidade na hora de ministrar.</p>
              <ul className="mt-8 space-y-4">
                {STAGE_POINTS.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-texto"><span className="flex size-5 items-center justify-center rounded-full bg-ambar/15 text-ambar-claro"><Check size={12} aria-hidden="true" /></span>{item}</li>
                ))}
              </ul>
              <Link href="/cadastro" className="mt-10 inline-flex min-h-12 items-center gap-3 rounded-full bg-ambar px-7 text-sm font-semibold text-sobre-ambar transition hover:bg-ambar-claro">Começar pelo louvor<ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
            <StagePreview />
          </div>
        </section>

        <section id="como-funciona" aria-labelledby="como-titulo" className="scroll-mt-20 px-5 py-24 sm:px-8 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <div className="flex justify-center"><SectionLabel>Uma rotina mais clara</SectionLabel></div>
              <h2 id="como-titulo" className="text-[28px] leading-[1.25] sm:text-[34px]">Menos tarefas desencontradas. Mais tempo para o que importa.</h2>
              <p className="mt-5 text-[15px] leading-7 text-texto-2">Uma rotina organizada ajuda cada pessoa a entender seu papel e participar com mais tranquilidade.</p>
            </div>
            <ol className="mt-16 grid gap-10 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative">
                  {index !== STEPS.length - 1 ? <div aria-hidden="true" className="absolute left-14 top-6 hidden h-px w-[calc(100%-24px)] bg-linha md:block" /> : null}
                  <span className="relative flex size-12 items-center justify-center rounded-full border border-ambar bg-fundo text-sm font-semibold text-ambar-claro">{index + 1}</span>
                  <h3 className="mt-6 text-lg">{step.title}</h3>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-texto-2">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="ia-titulo" className="px-5 pb-24 sm:px-8">
          <div className="mx-auto grid max-w-7xl overflow-hidden rounded-3xl border border-linha bg-superficie lg:grid-cols-[1.1fr_0.9fr]">
            <div className="p-8 sm:p-12 lg:p-14">
              <SectionLabel>Inteligência como apoio</SectionLabel>
              <h2 id="ia-titulo" className="max-w-xl text-[26px] leading-[1.25] sm:text-[32px]">Tecnologia para ajudar. Pessoas para decidir.</h2>
              <p className="mt-5 max-w-lg text-[15px] leading-7 text-texto-2">Os recursos de inteligência artificial vêm desligados e só funcionam se a igreja ativar. Eles apenas sugerem, como escalas e repertórios, e as decisões continuam nas mãos das lideranças.</p>
              <p className="mt-7 flex items-center gap-3 text-sm font-medium text-ambar-claro"><ShieldCheck size={18} aria-hidden="true" />Nada é publicado sem revisão de uma pessoa responsável</p>
            </div>
            <div className="flex items-center justify-center bg-superficie-2 p-8 sm:p-12">
              <ol className="w-full max-w-sm space-y-3">
                {AI_STEPS.map((t, i) => (
                  <li key={t} className="flex items-center gap-4 rounded-2xl border border-linha bg-superficie p-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ambar text-sm font-semibold text-sobre-ambar">{i + 1}</span>
                    <span className="text-sm font-medium text-texto">{t}</span>
                    {i === AI_STEPS.length - 1 ? <CheckCircle2 size={18} className="ml-auto text-sucesso" aria-hidden="true" /> : null}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section id="comecar" aria-labelledby="comecar-titulo" className="scroll-mt-20 brilho-ambar bg-superficie-2 px-5 py-20 text-center text-texto sm:px-8 lg:py-24">
          <div className="mx-auto max-w-3xl">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-linha bg-superficie text-ambar-claro"><HandHeart size={23} aria-hidden="true" /></span>
            <p className="mt-7 text-xs font-semibold uppercase tracking-[2.5px] text-ambar-claro">O próximo passo começa junto</p>
            <h2 id="comecar-titulo" className="mt-4 text-[28px] leading-[1.25] sm:text-[38px]">Sua igreja merece uma organização à altura da sua missão.</h2>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-7 text-texto-2">Crie a conta, cadastre a igreja e convide a equipe. Nada vem preenchido: o que aparece no sistema é o que a sua igreja cadastrou.</p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/cadastro" className="inline-flex min-h-12 items-center gap-3 rounded-full bg-ambar px-8 text-sm font-semibold text-sobre-ambar transition hover:bg-ambar-claro">Criar conta da igreja<ArrowUpRight size={16} aria-hidden="true" /></Link>
              {site.contactEmail ? <a href={`mailto:${site.contactEmail}`} className="inline-flex min-h-12 items-center rounded-full border border-borda px-8 text-sm font-semibold text-texto transition hover:border-ambar">Falar com a gente</a> : null}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-linha bg-palco px-5 py-8 text-texto-2 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 sm:flex-row">
          <div className="flex items-center gap-3">
            <Logo size={22} decorative />
            <BrandName className="text-sm" />
          </div>
          <p className="text-center text-xs">© {year} IGREJAQUA. Todos os direitos reservados.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            <Link href="/privacidade" className="inline-flex min-h-8 items-center transition hover:text-texto">Privacidade</Link>
            <Link href="/termos" className="inline-flex min-h-8 items-center transition hover:text-texto">Termos</Link>
            <Link href="/login" className="inline-flex min-h-8 items-center transition hover:text-texto">Entrar</Link>
            {site.socials.length > 0 ? (
              <nav aria-label="Redes sociais"><ul className="flex gap-1">{site.socials.map((s) => (
                <li key={s.network}><a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`${s.label} (abre em nova aba)`} className="inline-flex size-11 items-center justify-center rounded-full border border-linha transition hover:border-ambar hover:text-ambar-claro"><SocialIcon network={s.network} /></a></li>
              ))}</ul></nav>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  );
}
