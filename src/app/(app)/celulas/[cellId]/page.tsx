import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { getCell, listCellMeetings, listCellMemberIds } from "@/modules/cells/queries";
import { listMembers } from "@/modules/members/queries";
import { AddCellMemberForm, DeactivateCellButton, RecordMeetingForm, RemoveCellMemberButton } from "../cells-client";

export const metadata: Metadata = { title: "Célula" };
const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

export default async function CellPage({ params }: { params: Promise<{ cellId: string }> }) {
  const { cellId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(cellId)) notFound();
  const ctx = await resolveChurchContext();
  const cell = await getCell(ctx.churchId, cellId);
  if (cell === null) notFound();
  const [memberIds, meetings, directory] = await Promise.all([listCellMemberIds(ctx.churchId, cellId), listCellMeetings(ctx.churchId, cellId), listMembers(ctx.churchId)]);
  const nameOf = new Map(directory.map((m) => [m.membershipId, m.name]));
  const name = (id: string): string => nameOf.get(id) ?? "Membro";
  const isAdmin = can(ctx, "cell.manage");
  const isLeader = cell.leader_membership_id === ctx.membershipId;
  const canRun = isAdmin || isLeader;
  const participantIds = [cell.leader_membership_id, ...memberIds.filter((id) => id !== cell.leader_membership_id)];
  const candidates = directory.filter((m) => m.status === "active" && !participantIds.includes(m.membershipId));
  return (
    <>
      <PageHeader title={cell.name} description={`Líder: ${name(cell.leader_membership_id)}${cell.location ? ` · ${cell.location}` : ""}`} actions={isAdmin && cell.active ? <DeactivateCellButton cellId={cell.id} /> : undefined} />
      <section aria-labelledby="part" className="mb-10">
        <h2 id="part" className="mb-3 text-2xl">Participantes</h2>
        <ul className="divide-y divide-linha rounded-superficie border border-linha bg-superficie px-4">
          {participantIds.map((id) => (
            <li key={id} className="flex items-center justify-between gap-3 py-2">
              <span>{name(id)}{id === cell.leader_membership_id ? <span className="ml-2 text-xs text-texto-2">líder</span> : null}</span>
              {id === cell.leader_membership_id ? null : canRun ? <RemoveCellMemberButton cellId={cell.id} membershipId={id} label="Remover" /> : id === ctx.membershipId ? <RemoveCellMemberButton cellId={cell.id} membershipId={id} label="Sair da célula" /> : null}
            </li>
          ))}
        </ul>
        {canRun && cell.active ? <details className="mt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-ambar-claro">Adicionar participante</summary><AddCellMemberForm cellId={cell.id} candidates={candidates.map((c) => ({ id: c.membershipId, name: c.name }))} /></details> : null}
      </section>
      <section aria-labelledby="reunioes">
        <h2 id="reunioes" className="mb-3 text-2xl">Reuniões</h2>
        {meetings.length === 0 ? <EmptyState title="Nenhuma reunião registrada" /> : (
          <ul className="flex flex-col gap-3">
            {meetings.map((m) => (
              <li key={m.id} className="rounded-superficie border border-linha bg-superficie p-4">
                <p className="font-medium">{dateFmt.format(new Date(`${m.heldOn}T00:00:00Z`))}{m.topic ? ` — ${m.topic}` : ""}</p>
                <p className="text-sm text-texto-2">{m.attendeeIds.length} presente{m.attendeeIds.length === 1 ? "" : "s"}{m.attendeeIds.length > 0 ? `: ${m.attendeeIds.map(name).join(", ")}` : ""}</p>
                {m.notes ? <p className="mt-1 text-sm">{m.notes}</p> : null}
              </li>
            ))}
          </ul>
        )}
        {canRun && cell.active ? <div className="mt-8"><h3 className="mb-3 text-xl">Registrar reunião</h3><RecordMeetingForm cellId={cell.id} participants={participantIds.map((id) => ({ id, name: name(id) }))} /></div> : null}
      </section>
    </>
  );
}
