import Link from "next/link";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Logo } from "@/components/shared/logo";
import { buttonClasses } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";

const PAPEIS: readonly { readonly titulo: string; readonly texto: string }[] = [
  { titulo: "Quem lidera um ministério", texto: "Monta a escala do culto, convida cada pessoa para a função certa e vê quem confirmou, quem recusou e quem avisou que não pode. Indisponibilidades ficam registradas e não surpreendem ninguém na hora de escalar." },
  { titulo: "Quem toca e canta", texto: "Abre o repertório do domingo, escolhe o tom, transpõe a cifra e leva a música para o palco em tela escura, sem folha impressa. As confirmações de presença saem do mesmo lugar." },
  { titulo: "Quem cuida da secretaria", texto: "Convida membros por e-mail, define quem é administrador, líder ou membro e suspende um acesso quando for preciso. Cada pessoa só enxerga o que o papel dela permite." },
  { titulo: "Quem é da igreja", texto: "Recebe os comunicados, responde à escala, registra os dias em que não pode servir e acompanha as notificações. Os pedidos de oração podem ser feitos sem identificação." },
];

export default function HomePage() {
  const site = siteConfig();
  return (
    <>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-fundo focus:p-3">Pular para o conteúdo</a>
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
        <Link href="/" className="flex items-center gap-2 text-ambar" aria-label="IGREJAQUA, página inicial">
          <Logo size={30} /><span className="text-lg font-bold tracking-wide text-texto">IGREJAQUA</span>
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-2">
          <Link href="/login" className={buttonClasses("secondary")}>Entrar</Link>
          <Link href="/cadastro" className={buttonClasses("primary", "hidden sm:inline-flex")}>Criar conta</Link>
        </nav>
      </header>

      <main id="conteudo">
        <section className="brilho-ambar">
          <div className="mx-auto grid max-w-5xl gap-10 px-6 pb-20 pt-12 md:grid-cols-[1.4fr_1fr] md:pt-20">
            <div>
              <h1 className="max-w-[18ch] text-4xl md:text-5xl">
                {site.churchName ? `A organização do culto de ${site.churchName}, num só lugar.` : "A organização do culto da sua igreja, num só lugar."}
              </h1>
              <p className="mt-6 max-w-prose text-lg text-texto-2">
                Escala de ministérios, repertório com cifra, eventos, comunicados e pedidos de oração. Feito para quem serve aos domingos e para quem cuida da igreja durante a semana.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/cadastro" className={buttonClasses("primary", "min-h-12 px-7 text-base")}>Criar minha conta</Link>
                <Link href="/login" className={buttonClasses("quiet", "min-h-12 text-base")}>Já tenho conta</Link>
              </div>
            </div>
            <div aria-hidden="true" className="hidden items-center justify-center text-ambar/25 md:flex"><Logo size={240} /></div>
          </div>
        </section>

        <section aria-labelledby="papeis" className="mx-auto max-w-5xl px-6 py-16">
          <h2 id="papeis" className="max-w-[24ch] text-3xl">Cada pessoa abre o sistema e encontra a sua parte.</h2>
          <dl className="mt-10 divide-y divide-linha border-y border-linha">
            {PAPEIS.map((p) => (
              <div key={p.titulo} className="grid gap-2 py-6 md:grid-cols-[1fr_2fr] md:gap-10">
                <dt className="font-display text-xl font-bold">{p.titulo}</dt>
                <dd className="text-texto-2">{p.texto}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="palco" className="bg-superficie">
          <div className="mx-auto grid max-w-5xl gap-8 px-6 py-16 md:grid-cols-2 md:items-center">
            <div>
              <h2 id="palco" className="text-3xl">Modo palco</h2>
              <p className="mt-4 text-texto-2">Letra e cifra grandes, em fundo escuro, para ler com pouca luz. O tom pode ser trocado na hora e a música continua legível de longe.</p>
            </div>
            <pre aria-hidden="true" className="overflow-x-auto rounded-superficie bg-palco p-5 font-mono text-sm leading-7 text-palco-txt"><span className="text-palco-acorde">C       G        Am     F{"\n"}</span>Cifra acima da sílaba certa{"\n"}<span className="text-palco-acorde">F        C      G{"\n"}</span>sem trocar de papel</pre>
          </div>
        </section>

        <section aria-labelledby="cuidado" className="mx-auto max-w-5xl px-6 py-16">
          <div className="grid gap-10 md:grid-cols-2">
            <div>
              <h2 id="cuidado" className="text-3xl">Dados de fé pedem cuidado.</h2>
              <p className="mt-4 text-texto-2">Informações sobre pertencimento religioso são dados pessoais sensíveis pela LGPD. Por isso cada igreja tem o seu espaço separado, o acesso depende do papel de cada pessoa e a inteligência artificial é opcional, começa desligada e nunca publica nada sozinha.</p>
            </div>
            <ul className="flex flex-col gap-5">
              <li><p className="font-display font-bold">Pedido de oração anônimo de verdade</p><p className="mt-1 text-texto-2">Quando a pessoa escolhe o anonimato, nenhum papel do sistema consegue ver quem pediu.</p></li>
              <li><p className="font-display font-bold">Separação entre igrejas</p><p className="mt-1 text-texto-2">As regras de acesso são aplicadas no próprio banco de dados, não apenas na tela.</p></li>
              <li><p className="font-display font-bold">Contribuição por Pix</p><p className="mt-1 text-texto-2">Disponível quando a igreja ativa a integração com o Mercado Pago. Os valores só são confirmados depois que o provedor de pagamento confirma.</p></li>
            </ul>
          </div>
        </section>

        <section aria-labelledby="comecar" className="border-t border-linha">
          <div className="mx-auto flex max-w-5xl flex-col items-start gap-5 px-6 py-16">
            <h2 id="comecar" className="max-w-[26ch] text-3xl">Comece cadastrando a igreja e convidando a equipe.</h2>
            <p className="max-w-prose text-texto-2">Você cria a conta, registra a igreja e convida cada pessoa por link. Nada vem preenchido: o que aparece no sistema é o que a sua igreja cadastrou.</p>
            <Link href="/cadastro" className={buttonClasses("primary", "min-h-12 px-7 text-base")}>Criar minha conta</Link>
          </div>
        </section>
      </main>
      <SiteFooter site={site} />
    </>
  );
}
