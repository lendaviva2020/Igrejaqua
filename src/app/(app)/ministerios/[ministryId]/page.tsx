import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { getMinistryDetail } from "@/modules/ministries/member-queries";
import { AddMemberForm, MemberCard } from "./members-client";

export const metadata: Metadata = { title: "Ministério" };

export default async function MinistryPage({ params }: { params: Promise<{ ministryId: string }> }) {
  const idParsed = z.string().uuid().safeParse((await params).ministryId);
  if (!idParsed.success) notFound();
  const ministryId = idParsed.data;
  const ctx = await resolveChurchContext();
  const detail = await getMinistryDetail(ctx.churchId, ministryId);
  if (detail === null) notFound();
  const canManage = can(ctx, "ministry.members.manage", ministryId);
  const canGrant = can(ctx, "ministry.permissions.grant", ministryId);
  return (
    <>
      <p className="mb-2 text-sm"><Link className="text-ambar-claro underline" href="/ministerios">Ministérios</Link></p>
      <PageHeader title={detail.name} description={detail.description ?? "Integrantes e permissões deste ministério."} />
      <section aria-labelledby="integrantes">
        <h2 id="integrantes" className="mb-3 text-2xl">Integrantes ({detail.members.length})</h2>
        {detail.members.length === 0 ? <EmptyState title="Nenhum integrante ainda">{canManage ? "Adicione pessoas da igreja abaixo." : "A coordenação ainda não adicionou integrantes."}</EmptyState> : (
          <ul className="divide-y divide-linha rounded-superficie border border-linha bg-superficie px-4">
            {detail.members.map((m) => (
              <MemberCard key={m.id} ministryId={ministryId} member={m} canManage={canManage} canGrant={canGrant && m.membershipId !== ctx.membershipId} />
            ))}
          </ul>
        )}
      </section>
      {canManage ? (
        <section aria-labelledby="adicionar" className="mt-10">
          <h2 id="adicionar" className="mb-3 text-2xl">Adicionar integrante</h2>
          {detail.candidates.length === 0 ? <p className="text-texto-2">Todas as pessoas ativas da igreja já estão neste ministério. Convide novas pessoas em Membros.</p> : <AddMemberForm ministryId={ministryId} candidates={detail.candidates} />}
        </section>
      ) : null}
    </>
  );
}
