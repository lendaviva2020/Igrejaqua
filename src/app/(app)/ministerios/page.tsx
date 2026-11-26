import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { listMinistries } from "@/modules/ministries/queries";
import { MinistryForm } from "./ministry-form";

export const metadata: Metadata = { title: "Ministérios" };

export default async function MinistriesPage() {
  const ctx = await resolveChurchContext();
  const ministries = await listMinistries(ctx.churchId);
  return (
    <>
      <PageHeader title="Ministérios" description="Equipes e departamentos da igreja." />
      {ministries.length === 0 ? (
        <EmptyState title="Nenhum ministério cadastrado">{can(ctx, "ministry.create") ? "Crie o primeiro ministério abaixo." : "A administração ainda não cadastrou ministérios."}</EmptyState>
      ) : (
        <ul className="divide-y divide-linha rounded-superficie border border-linha bg-superficie px-4">
          {ministries.map((m) => (
            <li key={m.id} className="flex items-baseline justify-between gap-4 py-3">
              <div><Link href={`/ministerios/${m.id}`} className="font-medium text-ambar-claro underline">{m.name}</Link>{m.description ? <p className="text-sm text-texto-2">{m.description}</p> : null}</div>
              <p className="tabular text-sm text-texto-2">{m.memberCount} {m.memberCount === 1 ? "membro" : "membros"}</p>
            </li>
          ))}
        </ul>
      )}
      {can(ctx, "ministry.create") ? <section aria-labelledby="novo" className="mt-10"><h2 id="novo" className="mb-3 text-2xl">Novo ministério</h2><MinistryForm /></section> : null}
    </>
  );
}
