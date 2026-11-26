import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { listMembers } from "@/modules/members/queries";
import { listCells } from "@/modules/cells/queries";
import { WEEKDAY_LABEL } from "@/modules/cells/schemas";
import { NewCellForm } from "./cells-client";

export const metadata: Metadata = { title: "Células" };

export default async function CellsPage() {
  const ctx = await resolveChurchContext();
  const manage = can(ctx, "cell.manage");
  const [cells, members] = await Promise.all([listCells(ctx.churchId), listMembers(ctx.churchId)]);
  const nameOf = new Map(members.map((m) => [m.membershipId, m.name]));
  return (
    <>
      <PageHeader title="Células" description="Pequenos grupos que se reúnem durante a semana." />
      {cells.length === 0 ? <EmptyState title="Nenhuma célula cadastrada">{manage ? "Crie a primeira célula abaixo." : "A administração ainda não cadastrou células."}</EmptyState> : (
        <ul className="divide-y divide-linha rounded-superficie border border-linha bg-superficie px-4">
          {cells.map((c) => (
            <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-3 py-3">
              <div>
                <Link href={`/celulas/${c.id}`} className="font-medium text-ambar-claro underline">{c.name}</Link>{c.active ? null : <span className="ml-2 text-xs text-texto-2">(encerrada)</span>}
                <p className="text-sm text-texto-2">Líder: {nameOf.get(c.leader_membership_id) ?? "—"}{c.location ? ` · ${c.location}` : ""}</p>
              </div>
              <p className="tabular text-sm text-texto-2">{c.weekday === null ? "Sem dia fixo" : `${WEEKDAY_LABEL[c.weekday]}${c.meeting_time ? ` às ${c.meeting_time.slice(0, 5)}` : ""}`}</p>
            </li>
          ))}
        </ul>
      )}
      {manage ? <section aria-labelledby="nova" className="mt-10"><h2 id="nova" className="mb-3 text-2xl">Nova célula</h2><NewCellForm leaders={members.filter((m) => m.status === "active").map((m) => ({ id: m.membershipId, name: m.name }))} /></section> : null}
    </>
  );
}
