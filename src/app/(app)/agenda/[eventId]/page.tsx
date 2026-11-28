import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/shared/page-header";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { getChurchTimezone, getEventDetail } from "@/modules/events/queries";
import { listMinistries } from "@/modules/ministries/queries";
import { listLineupForSessions, listPeopleForMinistries } from "@/modules/schedules/queries";
import { getRsvpSummary } from "@/modules/rsvp/queries";
import { listPublishedVersionOptions, listSetlists } from "@/modules/setlists/queries";
import { getAttendance } from "@/modules/attendance/queries";
import { isCheckInOpen } from "@/modules/attendance/schemas";
import { AttendancePanel } from "./attendance-panel";
import { LineupPanel } from "./lineup-panel";
import { AiSchedulePanel } from "@/components/ai/ai-schedule-panel";
import { AiRepertoirePanel } from "@/components/ai/ai-repertoire-panel";
import { listRepertoireDrafts } from "@/modules/repertoire/ai-drafts";
import { getAiState } from "@/modules/settings/queries";
import { RsvpButtons } from "./rsvp-buttons";
import { SetlistPanel } from "./setlist-panel";
import { SessionForm } from "./session-form";

export const metadata: Metadata = { title: "Evento" };

export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  if (!z.string().uuid().safeParse(eventId).success) notFound();
  const ctx = await resolveChurchContext();
  const event = await getEventDetail(ctx.churchId, eventId);
  if (event === null) notFound();
  const sessionIds = event.event_sessions.map((x) => x.id);
  const canSetlist = can(ctx, "setlist.manage");
  const canRecordOthers = can(ctx, "attendance.record.others");
  const [tz, ministries, lineup, setlist, rsvp, attendance, versionOptions, ai, repertoireDrafts] = await Promise.all([
    getChurchTimezone(ctx.churchId),
    listMinistries(ctx.churchId),
    listLineupForSessions(ctx.churchId, ctx.membershipId, sessionIds),
    listSetlists(ctx.churchId, sessionIds),
    getRsvpSummary(ctx.churchId, ctx.membershipId, sessionIds),
    getAttendance(ctx.churchId, ctx.membershipId, sessionIds, canRecordOthers),
    canSetlist ? listPublishedVersionOptions(ctx.churchId) : Promise.resolve([]),
    getAiState(ctx.churchId),
    canSetlist ? listRepertoireDrafts(ctx.churchId, sessionIds) : Promise.resolve([]),
  ]);
  const relevantMinistries = ministries.filter((m) => can(ctx, "schedule.edit", m.id) || lineup.some((l) => l.ministryId === m.id));
  const people = await listPeopleForMinistries(ctx.churchId, relevantMinistries.map((m) => m.id));
  const fmt = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit", timeZone: tz });
  return (
    <>
      <PageHeader title={event.title} description={`${fmt.format(new Date(event.starts_at))}${event.location ? ` · ${event.location}` : ""}`} />
      {event.event_sessions.map((s) => (
        <article key={s.id} aria-labelledby={`s-${s.id}`} className="mb-8">
          <h3 id={`s-${s.id}`} className="text-xl">{s.name} <time dateTime={s.starts_at} className="tabular text-sm text-texto-2">{fmt.format(new Date(s.starts_at))}</time></h3>
          <RsvpButtons sessionId={s.id} current={rsvp.mine[s.id]} goingCount={can(ctx, "attendance.record.others") ? (rsvp.goingCount[s.id] ?? 0) : undefined} />
          <AttendancePanel sessionId={s.id} open={isCheckInOpen(new Date(s.starts_at), new Date(s.ends_at), new Date())} checkedIn={attendance.mineBySession[s.id] === true} canRecordOthers={canRecordOthers} entries={attendance.entriesBySession[s.id] ?? []} people={attendance.people} timeZone={tz} />
          <SetlistPanel sessionId={s.id} items={setlist.filter((x) => x.sessionId === s.id)} options={versionOptions} canEdit={canSetlist} />
          {(() => {
            const draft = repertoireDrafts.find((d) => d.sessionId === s.id);
            return draft !== undefined && !setlist.some((x) => x.sessionId === s.id) ? <AiRepertoirePanel eventId={event.id} draft={draft} /> : null;
          })()}
          {relevantMinistries.length === 0 ? <p className="py-3 text-sm text-texto-2">Nenhuma escala visível para você nesta sessão.</p> : relevantMinistries.map((m) => (
            <LineupPanel
              key={m.id}
              sessionId={s.id}
              ministryId={m.id}
              ministryName={m.name}
              items={lineup.filter((l) => l.sessionId === s.id && l.ministryId === m.id).map((l) => ({ id: l.id, function: l.function, status: l.status, personName: l.personName, ministryId: l.ministryId, mine: l.mine }))}
              people={people.filter((p) => p.ministryId === m.id)}
              canEdit={can(ctx, "schedule.edit", m.id)}
              canPublish={can(ctx, "schedule.publish", m.id)}
            />
          ))}
          {ai.enabled && ai.configured && s.ministry_id !== null && can(ctx, "schedule.edit", s.ministry_id) ? (
            <AiSchedulePanel sessionId={s.id} ministryName={ministries.find((m) => m.id === s.ministry_id)?.name ?? "Ministério"} />
          ) : null}
        </article>
      ))}
      {can(ctx, "event.manage") ? <section aria-labelledby="ns" className="mt-8"><h2 id="ns" className="mb-3 text-2xl">Nova sessão</h2><SessionForm eventId={event.id} /></section> : null}
    </>
  );
}
