import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { getActiveJoinLink, listMembers, listPendingInvitations } from "@/modules/members/queries";
import { joinLinkUrl } from "@/modules/members/token";
import { ROLE_LABEL } from "@/modules/members/schemas";
import { InviteForm, JoinLinkCard, JoinRequestRow, MemberRow, RevokeInviteButton } from "./members-client";

export const metadata: Metadata = { title: "Membros" };
const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export default async function MembersPage() {
  const ctx = await resolveChurchContext();
  if (!can(ctx, "member.invite")) notFound();
  const [directory, invitations, joinLink] = await Promise.all([listMembers(ctx.churchId), listPendingInvitations(ctx.churchId), getActiveJoinLink(ctx.churchId)]);
  const requests = directory.filter((m) => m.status === "pending");
  const members = directory.filter((m) => m.status !== "pending");
  return (
    <>
      <PageHeader title="Membros" description="Convide pessoas, defina papéis e suspenda acessos. Alterações valem na hora." />
      <section aria-labelledby="link-igreja" className="mb-10">
        <h2 id="link-igreja" className="mb-3 text-2xl">Link da igreja</h2>
        <JoinLinkCard link={joinLink === null ? null : joinLinkUrl(joinLink.token)} />
      </section>
      <section aria-labelledby="pedidos" className="mb-10">
        <h2 id="pedidos" className="mb-3 text-2xl">Pedidos para entrar{requests.length > 0 ? ` (${requests.length})` : ""}</h2>
        {requests.length === 0 ? <EmptyState title="Nenhum pedido aguardando">Quem usar o link da igreja aparece aqui para você aprovar.</EmptyState> : (
          <ul className="divide-y divide-linha rounded-superficie border border-linha bg-superficie px-4">
            {requests.map((r) => <JoinRequestRow key={r.membershipId} membershipId={r.membershipId} name={r.name} />)}
          </ul>
        )}
      </section>
      <section aria-labelledby="convidar" className="mb-10">
        <h2 id="convidar" className="mb-3 text-2xl">Convite individual (liderança e administração)</h2>
        <InviteForm />
      </section>
      <section aria-labelledby="pendentes" className="mb-10">
        <h2 id="pendentes" className="mb-3 text-2xl">Convites pendentes</h2>
        {invitations.length === 0 ? <EmptyState title="Nenhum convite pendente">Convites aceitos saem desta lista.</EmptyState> : (
          <ul className="divide-y divide-linha rounded-superficie border border-linha bg-superficie px-4">
            {invitations.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{i.email}</p>
                  <p className="text-sm text-texto-2">{ROLE_LABEL[i.role]} · expira em {dateFmt.format(new Date(i.expires_at))}{new Date(i.expires_at) < new Date() ? " (expirado)" : ""}</p>
                </div>
                <RevokeInviteButton invitationId={i.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="todos">
        <h2 id="todos" className="mb-3 text-2xl">Pessoas ({members.length})</h2>
        <ul className="divide-y divide-linha rounded-superficie border border-linha bg-superficie px-4">
          {members.map((m) => (
            <MemberRow key={m.membershipId} membershipId={m.membershipId} name={m.name} role={m.role} status={m.status} isSelf={m.membershipId === ctx.membershipId} />
          ))}
        </ul>
      </section>
    </>
  );
}
