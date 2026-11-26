import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { listContent } from "@/modules/content/queries";
import { CONTENT_KIND_LABEL } from "@/modules/content/schemas";
import { getChurchTimezone } from "@/modules/events/queries";
import { listMinistries } from "@/modules/ministries/queries";
import { ContentActions } from "./content-actions";
import { ContentForm, type AudienceOption } from "./content-form";

export const metadata: Metadata = { title: "Comunicados" };

export default async function ContentPage() {
  const ctx = await resolveChurchContext();
  const [items, ministries, tz] = await Promise.all([listContent(ctx.churchId), listMinistries(ctx.churchId), getChurchTimezone(ctx.churchId)]);
  const ministryName = new Map(ministries.map((m) => [m.id, m.name] as const));
  const audiences: AudienceOption[] = [
    ...(can(ctx, "content.publish.church") ? [{ value: "church", label: "Toda a igreja" }] : []),
    ...ministries.filter((m) => can(ctx, "content.publish.ministry", m.id)).map((m) => ({ value: m.id, label: m.name })),
  ];
  const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: tz });
  const fmtFull = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz });
  return (
    <>
      <PageHeader title="Comunicados" description="Avisos e devocionais da igreja e dos seus ministérios." />
      {items.length === 0 ? <EmptyState title="Nada publicado ainda">Os comunicados da liderança aparecerão aqui.</EmptyState> : (
        <ul className="flex flex-col gap-3">
          {items.map((c) => (
            <li key={c.id} className="rounded-superficie border border-linha bg-superficie p-4">
              <p className="text-xs uppercase tracking-wide text-ambar-claro">
                {CONTENT_KIND_LABEL[c.kind]}{c.audience === "ministry" && c.ministry_id ? ` · ${ministryName.get(c.ministry_id) ?? "Ministério"}` : ""}
                {c.status === "draft" ? " · Rascunho" : ""}
                {c.status === "scheduled" && c.publish_at ? <> · Agendado para <time dateTime={c.publish_at}>{fmtFull.format(new Date(c.publish_at))}</time></> : null}
                {c.published_at ? <> · <time dateTime={c.published_at}>{fmt.format(new Date(c.published_at))}</time></> : null}
              </p>
              <h2 className="mt-1 text-lg">{c.title}</h2>
              {c.scripture_ref ? <p className="text-sm text-texto-2">{c.scripture_ref}</p> : null}
              {/* Texto puro (sem HTML/Markdown interpretado): elimina XSS armazenado. */}
              <p className="mt-2 whitespace-pre-wrap text-texto-2">{c.body_md}</p>
              {audiences.length > 0 && (c.audience === "church" ? can(ctx, "content.publish.church") : c.ministry_id !== null && can(ctx, "content.publish.ministry", c.ministry_id)) ? <ContentActions id={c.id} status={c.status} /> : null}
            </li>
          ))}
        </ul>
      )}
      {audiences.length > 0 ? <section aria-labelledby="novo" className="mt-10"><h2 id="novo" className="mb-3 text-2xl">Novo conteúdo</h2><ContentForm audiences={audiences} timezone={tz} /></section> : null}
    </>
  );
}
