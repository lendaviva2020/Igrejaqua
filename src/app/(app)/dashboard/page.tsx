import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, CalendarOff, HandHeart, Library, Users, type LucideIcon } from "lucide-react";
import { DateBadge } from "@/components/shared/date-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { resolveChurchContext } from "@/lib/auth/context";
import { ScriptureLink } from "@/components/bible/scripture-link";
import { getLatestDevotionalReading } from "@/modules/content/queries";
import { getChurchTimezone, listMyUpcomingLineup, listUpcomingEvents } from "@/modules/events/queries";
import { EVENT_KIND_LABEL } from "@/modules/events/schemas";

export const metadata: Metadata = { title: "Painel" };

const STATUS_LABEL: Record<string, string> = { published: "Aguardando confirmação", confirmed: "Confirmado" };
const SHORTCUTS: readonly { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/repertorio", label: "Repertório", icon: Library },
  { href: "/oracao", label: "Pedidos de oração", icon: HandHeart },
  { href: "/ministerios", label: "Ministérios", icon: Users },
  { href: "/disponibilidade", label: "Minha disponibilidade", icon: CalendarOff },
];

export default async function DashboardPage() {
  const ctx = await resolveChurchContext();
  const [events, mine, tz, reading] = await Promise.all([listUpcomingEvents(ctx.churchId), listMyUpcomingLineup(ctx.churchId, ctx.membershipId), getChurchTimezone(ctx.churchId), getLatestDevotionalReading(ctx.churchId)]);
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  const full = new Intl.DateTimeFormat("pt-BR", { weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: tz });
  const next = events[0];
  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Boas-vindas" className="brilho-ambar rounded-superficie border border-linha bg-superficie p-6">
        <h1 className="text-3xl font-bold">Bem-vindo(a)!</h1>
        <p className="mt-1 text-texto-2">Que bom ter você em {ctx.churchName}.</p>
      </section>

      {reading === null ? null : (
        <section aria-labelledby="leitura" className="rounded-superficie border border-linha bg-superficie p-4">
          <h2 id="leitura" className="text-sm uppercase tracking-wide text-ambar-claro">Leitura do dia</h2>
          <p className="mt-1 text-lg">{reading.title}</p>
          <ScriptureLink reference={reading.scripture_ref} />
        </section>
      )}

      <section aria-labelledby="proximo">
        <h2 id="proximo" className="sr-only">Próximo compromisso</h2>
        {next === undefined ? (
          <EmptyState title="Nenhum evento agendado">Os eventos publicados pela liderança aparecerão aqui.</EmptyState>
        ) : (
          <Link href={`/agenda/${next.id}`} className="flex items-center gap-4 rounded-superficie border border-linha bg-superficie p-4 hover:bg-superficie-2">
            <DateBadge iso={next.starts_at} timeZone={tz} />
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wide text-ambar-claro">Próximo · {EVENT_KIND_LABEL[next.kind as keyof typeof EVENT_KIND_LABEL] ?? next.kind}</p>
              <p className="truncate text-lg font-semibold">{next.title}</p>
              <p className="truncate text-sm text-texto-2 capitalize">{full.format(new Date(next.starts_at))}{next.location ? ` · ${next.location}` : ""}</p>
            </div>
            <span className="flex items-center gap-1 text-sm text-ambar-claro">Ver detalhes <ArrowRight aria-hidden="true" size={16} /></span>
          </Link>
        )}
      </section>

      <nav aria-label="Atalhos">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SHORTCUTS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-superficie border border-linha bg-superficie p-3 text-center text-sm hover:bg-superficie-2">
                <Icon aria-hidden="true" size={26} strokeWidth={1.75} className="text-ambar" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-labelledby="minha-escala">
        <h2 id="minha-escala" className="mb-3 text-xl">Minha escala</h2>
        {mine.length === 0 ? (
          <EmptyState title="Nenhuma escala publicada para você">Quando um líder publicar uma escala com o seu nome, ela aparece aqui.</EmptyState>
        ) : (
          <ol className="flex flex-col gap-3">
            {mine.map((l) => (
              <li key={l.id} className="flex items-center gap-4 rounded-superficie border border-linha bg-superficie p-4">
                <DateBadge iso={l.event_sessions.starts_at} timeZone={tz} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{l.event_sessions.events.title} · {l.event_sessions.name}</p>
                  <p className="text-sm text-texto-2">{l.function} · <time dateTime={l.event_sessions.starts_at}>{time.format(new Date(l.event_sessions.starts_at))}</time></p>
                  <p className={l.status === "confirmed" ? "text-sm text-sucesso" : "text-sm text-ambar-claro"}>{STATUS_LABEL[l.status] ?? l.status}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
