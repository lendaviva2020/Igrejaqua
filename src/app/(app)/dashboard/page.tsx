import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { resolveChurchContext } from "@/lib/auth/context";
import { listMyUpcomingLineup, listUpcomingEvents } from "@/modules/events/queries";

export const metadata: Metadata = { title: "Painel" };

const dateFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const STATUS_LABEL: Record<string, string> = { published: "Aguardando confirmação", confirmed: "Confirmado" };

export default async function DashboardPage() {
  const ctx = await resolveChurchContext();
  const [events, mine] = await Promise.all([listUpcomingEvents(ctx.churchId), listMyUpcomingLineup(ctx.churchId, ctx.membershipId)]);
  return (
    <>
      <PageHeader title="Painel" description={`Próximos compromissos de ${ctx.churchName}.`} />
      <section aria-labelledby="minha-escala" className="mb-10">
        <h2 id="minha-escala" className="mb-3 text-2xl">Minha escala</h2>
        {mine.length === 0 ? (
          <EmptyState title="Nenhuma escala publicada para você">Quando um líder publicar uma escala com o seu nome, ela aparece aqui.</EmptyState>
        ) : (
          <ol className="divide-y divide-linha border-y border-linha">
            {mine.map((l) => (
              <li key={l.id} className="grid grid-cols-[7.5rem_1fr] gap-4 py-3">
                <time className="tabular text-sm text-tinta-2" dateTime={l.event_sessions.starts_at}>{dateFmt.format(new Date(l.event_sessions.starts_at))}</time>
                <div>
                  <p className="font-medium">{l.event_sessions.events.title} · {l.event_sessions.name}</p>
                  <p className="text-sm text-tinta-2">{l.function} — {STATUS_LABEL[l.status] ?? l.status}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section aria-labelledby="agenda">
        <h2 id="agenda" className="mb-3 text-2xl">Agenda da igreja</h2>
        {events.length === 0 ? (
          <EmptyState title="Nenhum evento agendado">Os eventos publicados pela liderança aparecerão aqui.</EmptyState>
        ) : (
          <ol className="divide-y divide-linha border-y border-linha">
            {events.map((e) => (
              <li key={e.id} className="grid grid-cols-[7.5rem_1fr] gap-4 py-3">
                <time className="tabular text-sm text-tinta-2" dateTime={e.starts_at}>{dateFmt.format(new Date(e.starts_at))}</time>
                <div><p className="font-medium">{e.title}</p>{e.location ? <p className="text-sm text-tinta-2">{e.location}</p> : null}</div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
