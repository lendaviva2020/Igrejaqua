import type { Metadata } from "next";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { PageHeader } from "@/components/shared/page-header";
import { getAiState, getChurchData, getMyProfile, listDataRequests } from "@/modules/settings/queries";
import { getMfaState } from "@/modules/security/queries";
import { MfaSettings } from "@/components/security/mfa-settings";
import { NewPasswordForm } from "../../(auth)/redefinir-senha/new-password-form";
import { AiSettings, ChurchForm, DsrAdminRow, DsrForm, ProfileForm } from "./settings-client";
import { DSR_KIND_LABEL, DSR_STATUS_LABEL } from "@/modules/settings/schemas";
import { getPaymentSetup } from "@/modules/contributions/payment-method";
import { PaymentSettings } from "./payment-settings";

export const metadata: Metadata = { title: "Configurações" };
const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ mp?: string }> }) {
  const ctx = await resolveChurchContext();
  const { mp } = await searchParams;
  const isAdmin = can(ctx, "church.settings.update");
  const [profile, church, requests, ai, mfa] = await Promise.all([getMyProfile(ctx.userId), isAdmin ? getChurchData(ctx.churchId) : Promise.resolve(null), listDataRequests(ctx.churchId, ctx.userId), isAdmin ? getAiState(ctx.churchId) : Promise.resolve(null), getMfaState(ctx.role)]);
  const payments = can(ctx, "finance.manage") ? await getPaymentSetup(ctx.churchId) : null;
  const mine = requests.filter((r) => r.mine);
  const toHandle = requests.filter((r) => !r.mine || isAdmin);
  return (
    <>
      <PageHeader title="Configurações" description="Seu perfil, sua senha e seus direitos sobre os seus dados." />
      <div className="flex flex-col gap-12">
        <section aria-labelledby="perfil"><h2 id="perfil" className="mb-3 text-2xl">Meu perfil</h2><ProfileForm initial={{ fullName: profile.full_name, displayName: profile.display_name ?? "", phone: profile.phone ?? "" }} /></section>
        <section aria-labelledby="senha"><h2 id="senha" className="mb-3 text-2xl">Senha</h2><div className="max-w-md"><NewPasswordForm /></div></section>
        <section aria-labelledby="mfa"><h2 id="mfa" className="mb-3 text-2xl">Verificação em duas etapas</h2><MfaSettings factorId={mfa.factorId} promptEnrollment={mfa.promptEnrollment} /></section>
        <section aria-labelledby="privacidade">
          <h2 id="privacidade" className="mb-3 text-2xl">Privacidade e meus dados</h2>
          <p className="mb-4 max-w-prose text-texto-2">Você pode baixar uma cópia dos seus dados ou fazer um pedido formal à administração da igreja. O prazo de resposta é de 15 dias.</p>
          <a href="/api/me/export" download className="mb-6 inline-flex min-h-11 items-center rounded-full border border-borda px-5 text-sm font-semibold hover:bg-superficie-2">Baixar meus dados (JSON)</a>
          <DsrForm />
          {mine.length > 0 ? (
            <ul className="mt-6 divide-y divide-linha rounded-superficie border border-linha bg-superficie px-4">
              {mine.map((r) => (
                <li key={r.id} className="py-3"><p className="font-medium">{DSR_KIND_LABEL[r.kind]}</p><p className="text-sm text-texto-2">{DSR_STATUS_LABEL[r.status]} · aberto em {dateFmt.format(new Date(r.createdAt))} · prazo {dateFmt.format(new Date(r.dueAt))}</p></li>
              ))}
            </ul>
          ) : null}
        </section>
        {isAdmin && church !== null ? (
          <>
            <section aria-labelledby="igreja"><h2 id="igreja" className="mb-3 text-2xl">Dados da igreja</h2><ChurchForm initial={{ name: church.name, legalName: church.legal_name ?? "", documentNumber: church.document_number ?? "", timezone: church.timezone }} /></section>
            {payments !== null ? <section id="contribuicoes" aria-labelledby="contribuicoes-titulo" className="scroll-mt-20"><h2 id="contribuicoes-titulo" className="mb-3 text-2xl">Contribuições</h2><PaymentSettings setup={payments} mpStatus={typeof mp === "string" && /^[a-z-]{3,20}$/.test(mp) ? mp : null} /></section> : null}
            {ai !== null ? <section aria-labelledby="ia"><h2 id="ia" className="mb-3 text-2xl">Inteligência artificial</h2><AiSettings enabled={ai.enabled} configured={ai.configured} /></section> : null}
            <section aria-labelledby="pedidos">
              <h2 id="pedidos" className="mb-3 text-2xl">Pedidos de titulares</h2>
              {toHandle.length === 0 ? <p className="text-texto-2">Nenhum pedido recebido.</p> : (
                <ul className="divide-y divide-linha rounded-superficie border border-linha bg-superficie px-4">
                  {toHandle.map((r) => <DsrAdminRow key={r.id} id={r.id} requester={r.requester} kind={DSR_KIND_LABEL[r.kind]} status={r.status} statusLabel={DSR_STATUS_LABEL[r.status]} details={r.details} due={dateFmt.format(new Date(r.dueAt))} />)}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </div>
    </>
  );
}
