import type { Metadata } from "next";
import { listMyChurches, requireUser } from "@/lib/auth/context";
import { PageHeader } from "@/components/shared/page-header";
import { AcceptInvitationForm, CreateChurchForm, SwitchChurchButton } from "./church-forms";

export const metadata: Metadata = { title: "Selecionar igreja" };

export default async function SelectChurchPage({ searchParams }: { searchParams: Promise<{ convite?: string }> }) {
  const { convite } = await searchParams;
  const user = await requireUser();
  const churches = await listMyChurches(user.id);
  return (
    <>
      <PageHeader title="Sua igreja" description="Escolha o contexto em que deseja trabalhar, entre com um convite ou cadastre uma nova igreja." />
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
      <div className="grid gap-10 md:grid-cols-2">
        <section aria-labelledby="convite"><h2 id="convite" className="mb-3 text-2xl">Tenho um convite</h2><AcceptInvitationForm {...(convite ? { initialToken: convite.slice(0, 200) } : {})} /></section>
        <section aria-labelledby="nova"><h2 id="nova" className="mb-3 text-2xl">Cadastrar igreja</h2><CreateChurchForm /></section>
      </div>
    </>
  );
}
