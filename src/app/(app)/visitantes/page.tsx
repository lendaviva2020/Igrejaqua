import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { listVisitors } from "@/modules/visitors/queries";
import { FOLLOWUP_KIND_LABEL, VISITOR_STATUS_LABEL } from "@/modules/visitors/schemas";
import { DeleteVisitorButton, FollowupForm, NewVisitorForm, StatusSelect } from "./visitors-client";

export const metadata: Metadata = { title: "Visitantes" };
const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const fmt = (iso: string): string => dateFmt.format(new Date(`${iso}T00:00:00Z`));

export default async function VisitorsPage() {
  const ctx = await resolveChurchContext();
  if (!can(ctx, "visitor.manage")) notFound();
  const visitors = await listVisitors(ctx.churchId);
  const canDelete = can(ctx, "visitor.delete");
  return (
    <>
      <PageHeader title="Visitantes" description="Acompanhe quem visitou a igreja. Telefone e e-mail só são guardados com a autorização da pessoa." />
      {visitors.length === 0 ? <EmptyState title="Nenhum visitante cadastrado">Cadastre o primeiro visitante abaixo.</EmptyState> : (
        <ul className="flex flex-col gap-4">
          {visitors.map((v) => (
            <li key={v.id} className="rounded-superficie border border-linha bg-superficie p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl">{v.full_name}</h2>
                  <p className="text-sm text-texto-2">Primeira visita em {fmt(v.first_visit_on)}{v.source ? ` · ${v.source}` : ""}</p>
                  {v.phone || v.email ? <p className="text-sm text-texto-2">{[v.phone, v.email].filter(Boolean).join(" · ")}</p> : null}
                  {v.notes ? <p className="mt-1 text-sm">{v.notes}</p> : null}
                </div>
                <div className="flex flex-col items-end gap-2"><StatusSelect visitorId={v.id} status={v.status} />{canDelete ? <DeleteVisitorButton visitorId={v.id} /> : null}</div>
              </div>
              <p className="mt-2 text-xs uppercase tracking-wide text-texto-2">{VISITOR_STATUS_LABEL[v.status]}</p>
              {v.visit_followups.length > 0 ? (
                <ul className="mt-2 divide-y divide-linha text-sm">
                  {v.visit_followups.map((f) => <li key={f.id} className="py-2"><span className="font-medium">{FOLLOWUP_KIND_LABEL[f.kind]}</span> · {fmt(f.done_on)} — {f.note}</li>)}
                </ul>
              ) : null}
              <details className="mt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-ambar-claro">Registrar contato</summary><FollowupForm visitorId={v.id} /></details>
            </li>
          ))}
        </ul>
      )}
      <section aria-labelledby="novo" className="mt-10"><h2 id="novo" className="mb-3 text-2xl">Novo visitante</h2><NewVisitorForm /></section>
    </>
  );
}
