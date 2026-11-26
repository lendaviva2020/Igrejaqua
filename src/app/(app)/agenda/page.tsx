import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { getChurchTimezone, listUpcomingEvents } from "@/modules/events/queries";
import { EVENT_KIND_LABEL } from "@/modules/events/schemas";
import { EventForm } from "./event-form";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage() {
  const ctx = await resolveChurchContext();
  const [events, tz] = await Promise.all([listUpcomingEvents(ctx.churchId, 50), getChurchTimezone(ctx.churchId)]);
  const fmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz });
  return (
    <>
      <PageHeader title="Agenda" description="Cultos, ensaios e eventos da igreja." />
      {events.length === 0 ? (
        <EmptyState title="Nenhum evento agendado">{can(ctx, "event.manage") ? "Crie o primeiro evento abaixo." : "Ainda não há eventos futuros."}</EmptyState>
      ) : (
        <ul className="divide-y divide-linha border-y border-linha">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/agenda/${e.id}`} className="flex min-h-11 items-baseline justify-between gap-4 py-3 hover:bg-superficie">
                <span><span className="font-medium">{e.title}</span> <span className="text-sm text-tinta-2">· {EVENT_KIND_LABEL[e.kind as keyof typeof EVENT_KIND_LABEL] ?? e.kind}</span></span>
                <time dateTime={e.starts_at} className="tabular text-sm text-tinta-2">{fmt.format(new Date(e.starts_at))}</time>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {can(ctx, "event.manage") ? <section aria-labelledby="novo" className="mt-10"><h2 id="novo" className="mb-3 text-2xl">Novo evento</h2><EventForm /></section> : null}
    </>
  );
}
