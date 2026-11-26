import type { Metadata } from "next";
import { listMyChurches, requireUser } from "@/lib/auth/context";
import { PageHeader } from "@/components/shared/page-header";
import { AcceptInvitationForm, CreateChurchForm, SwitchChurchButton } from "./church-forms";

export const metadata: Metadata = { title: "Selecionar igreja" };

export default async function SelectChurchPage() {
  const user = await requireUser();
  const churches = await listMyChurches(user.id);
  return (
    <>
      <PageHeader title="Sua igreja" description="Escolha o contexto em que deseja trabalhar, entre com um convite ou cadastre uma nova igreja." />
      {churches.length > 0 ? (
        <section aria-labelledby="minhas" className="mb-10">
          <h2 id="minhas" className="mb-3 text-2xl">Suas igrejas</h2>
          <ul className="divide-y divide-linha border-y border-linha">
            {churches.map((c) => (
              <li key={c.churchId} className="flex items-center justify-between gap-4 py-3">
                <div><p className="font-medium">{c.name}</p><p className="text-sm text-tinta-2">{c.role === "admin" ? "Administração" : c.role === "leader" ? "Liderança" : "Membro"}</p></div>
                <SwitchChurchButton churchId={c.churchId} label="Entrar" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="grid gap-10 md:grid-cols-2">
        <section aria-labelledby="convite"><h2 id="convite" className="mb-3 text-2xl">Tenho um convite</h2><AcceptInvitationForm /></section>
        <section aria-labelledby="nova"><h2 id="nova" className="mb-3 text-2xl">Cadastrar igreja</h2><CreateChurchForm /></section>
      </div>
    </>
  );
}
