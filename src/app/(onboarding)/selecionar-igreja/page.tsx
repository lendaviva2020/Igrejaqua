import type { Metadata } from "next";
import Link from "next/link";
import { listMyChurches, listMyPendingJoinRequests, requireUser } from "@/lib/auth/context";
import { PageHeader } from "@/components/shared/page-header";
import { CreateChurchForm, IntentChooser, JoinWithCodeForm, SwitchChurchButton } from "./church-forms";

export const metadata: Metadata = { title: "Selecionar igreja" };
const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

/**
 * Dois caminhos (decisão do responsável, 2026-11-27):
 * - liderança: cadastra a igreja (e ainda pode usar um convite);
 * - membro: entra pelo link/código da igreja; criar igreja fica num link discreto, para quem escolheu errado.
 * O caminho só muda a tela — o que a pessoa pode fazer vem do vínculo com a igreja (RLS).
 */
export default async function SelectChurchPage({ searchParams }: { searchParams: Promise<{ convite?: string; caminho?: string }> }) {
  const { convite, caminho } = await searchParams;
  const user = await requireUser();
  const [churches, pendingRequests] = await Promise.all([listMyChurches(user.id), listMyPendingJoinRequests()]);
  const inviteCode = convite?.slice(0, 200);
  const path = caminho === "lideranca" ? "leader" : caminho === "membro" || inviteCode ? "member" : user.intent;

  return (
    <>
      <PageHeader
        title="Sua igreja"
        description={path === "leader" ? "Cadastre sua igreja para começar a organizar ministérios, escalas e comunicação." : "Escolha a igreja em que deseja entrar."}
      />
      {churches.length > 0 ? (
        <section aria-labelledby="minhas" className="mb-10">
          <h2 id="minhas" className="mb-3 text-2xl">Suas igrejas</h2>
          <ul className="divide-y divide-linha rounded-superficie border border-linha bg-superficie px-4">
            {churches.map((c) => (
              <li key={c.churchId} className="flex items-center justify-between gap-4 py-3">
                <div><p className="font-medium">{c.name}</p><p className="text-sm text-texto-2">{c.role === "admin" ? "Administração" : c.role === "leader" ? "Liderança" : "Membro"}</p></div>
                <SwitchChurchButton churchId={c.churchId} label="Entrar" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {pendingRequests.length > 0 ? (
        <section aria-labelledby="aguardando" className="mb-10">
          <h2 id="aguardando" className="mb-3 text-2xl">Aguardando aprovação</h2>
          <ul className="divide-y divide-linha rounded-superficie border border-linha bg-superficie px-4">
            {pendingRequests.map((r) => (
              <li key={r.churchId} className="py-3">
                <p className="font-medium">{r.churchName}</p>
                <p className="text-sm text-texto-2">Pedido enviado em {dateFmt.format(new Date(r.requestedAt))}. A administração da igreja precisa aprovar.</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {path === null ? (
        <section aria-labelledby="caminho" className="max-w-xl">
          <h2 id="caminho" className="mb-3 text-2xl">Como você vai usar o IGREJAQUA?</h2>
          <IntentChooser />
        </section>
      ) : path === "leader" ? (
        <div className="grid gap-10 md:grid-cols-2">
          <section aria-labelledby="nova"><h2 id="nova" className="mb-3 text-2xl">Cadastrar igreja</h2><CreateChurchForm /></section>
          <section aria-labelledby="convite">
            <h2 id="convite" className="mb-3 text-2xl">Recebeu um link?</h2>
            <JoinWithCodeForm />
            <p className="mt-4 text-sm"><Link className="text-ambar-claro underline" href="/selecionar-igreja?caminho=membro">Faço parte de uma igreja e não sou da liderança</Link></p>
          </section>
        </div>
      ) : (
        <section aria-labelledby="entrar" className="max-w-md">
          <h2 id="entrar" className="mb-3 text-2xl">Entrar na sua igreja</h2>
          <JoinWithCodeForm {...(inviteCode ? { initialCode: inviteCode } : {})} />
          <p className="mt-4 text-sm text-texto-2">Ainda não tem o link? Peça ao pastor ou à liderança da sua igreja.</p>
          <p className="mt-8 text-sm"><Link className="text-texto-2 underline" href="/selecionar-igreja?caminho=lideranca">Sou da liderança e quero cadastrar uma igreja</Link></p>
        </section>
      )}
    </>
  );
}
