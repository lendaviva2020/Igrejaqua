import { AI_LIMITS } from "@/lib/ai/config";
import { sanitizeLabel, type SchedulePayload } from "@/lib/ai/prompts/schedule";
import type { Pseudonymizer } from "@/lib/ai/pseudonymize";
import type { AiScheduleOutput } from "@/lib/ai/schemas/schedule";
import type { Candidate, ExistingAssignment, ProposedAssignment, RotationPolicy, SessionFacts, Violation } from "@/lib/ai/validators/schedule";

export interface Slot {
  readonly function: string;
  readonly count: number;
}

export interface PersonFact {
  readonly ministryMembershipId: string;
  readonly membershipId: string;
  readonly displayName: string;
  /** Instrumentos e naipe vocal cadastrados (texto livre: sempre sanitizado antes de uso). */
  readonly functions: readonly string[];
  readonly available: boolean;
}

export interface LineupFact {
  readonly sessionId: string;
  readonly membershipId: string;
  readonly function: string;
  readonly startsAt: number;
  readonly endsAt: number;
}

export interface ScheduleFacts {
  readonly churchId: string;
  readonly ministryId: string;
  readonly session: SessionFacts;
  readonly policy: RotationPolicy;
  readonly windowWeeks: number;
  readonly timezone: string;
  readonly people: readonly PersonFact[];
  /** Escalas ativas (draft/published/confirmed) das pessoas do ministério na janela relevante. */
  readonly lineup: readonly LineupFact[];
  readonly slots: readonly Slot[];
}

const norm = (value: string): string => value.trim().toLocaleLowerCase("pt-BR");
const WEEK_MS = 7 * 24 * 3_600_000;

function monthKey(epochMs: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(new Date(epochMs));
  return `${parts.find((p) => p.type === "year")?.value ?? ""}-${parts.find((p) => p.type === "month")?.value ?? ""}`;
}

/** Vagas pedidas, com rótulo sanitizado e sem duplicatas (norm). */
export function normalizeSlots(slots: readonly Slot[]): readonly Slot[] {
  const seen = new Set<string>();
  const out: Slot[] = [];
  for (const slot of slots) {
    const label = sanitizeLabel(slot.function);
    if (label === null || seen.has(norm(label))) continue;
    seen.add(norm(label));
    out.push({ function: label, count: Math.min(Math.max(Math.trunc(slot.count), 1), AI_LIMITS.maxSlotCount) });
  }
  return out.slice(0, AI_LIMITS.maxSlots);
}

export interface BuiltContext {
  readonly slots: readonly Slot[];
  readonly candidates: readonly Candidate[];
  readonly existing: readonly ExistingAssignment[];
  readonly displayNames: ReadonlyMap<string, string>;
}

/** Transforma fatos do banco em candidatos para a validação e para o prompt (cálculo 100% em código). */
export function buildContext(facts: ScheduleFacts): BuiltContext {
  const slots = normalizeSlots(facts.slots);
  const { session } = facts;
  const windowStart = session.startsAt - facts.windowWeeks * WEEK_MS;
  const thisMonth = monthKey(session.startsAt, facts.timezone);
  const alreadyInSession = new Set(facts.lineup.filter((l) => l.sessionId === session.id).map((l) => l.membershipId));

  const candidates: Candidate[] = [];
  for (const person of facts.people) {
    if (!facts.policy.allowMultiFunction && alreadyInSession.has(person.membershipId)) continue;
    const labels = person.functions.map(sanitizeLabel).filter((l): l is string => l !== null);
    const relevant = slots.filter((slot) => labels.some((l) => norm(l) === norm(slot.function))).map((slot) => slot.function);
    if (relevant.length === 0) continue;
    const mine = facts.lineup.filter((l) => l.membershipId === person.membershipId);
    const recentByFunction: Record<string, number> = {};
    for (const fn of relevant) {
      recentByFunction[fn] = mine.filter((l) => l.sessionId !== session.id && l.startsAt >= windowStart && l.startsAt < session.startsAt && norm(l.function) === norm(fn)).length;
    }
    candidates.push({
      ministryMembershipId: person.ministryMembershipId,
      membershipId: person.membershipId,
      churchId: facts.churchId,
      ministryId: facts.ministryId,
      active: true,
      functions: relevant,
      available: person.available,
      scheduledThisMonth: mine.filter((l) => l.sessionId !== session.id && monthKey(l.startsAt, facts.timezone) === thisMonth).length,
      recentByFunction,
    });
  }
  // Ordem estável: menos escalados primeiro; corta no limite sem enviar mais do que o necessário ao provedor.
  const total = (c: Candidate): number => Object.values(c.recentByFunction).reduce((a, b) => a + b, 0);
  candidates.sort((a, b) => total(a) - total(b) || a.ministryMembershipId.localeCompare(b.ministryMembershipId));

  return {
    slots,
    candidates: candidates.slice(0, AI_LIMITS.maxCandidates),
    existing: facts.lineup.map((l) => ({ membershipId: l.membershipId, sessionId: l.sessionId, startsAt: l.startsAt, endsAt: l.endsAt })),
    displayNames: new Map(facts.people.map((p) => [p.ministryMembershipId, p.displayName] as const)),
  };
}

/** Monta o payload enviado ao provedor: sem nomes, ids reais, e-mails ou motivos (AI_ENGINE §6). */
export function buildPayload(context: Pick<BuiltContext, "slots" | "candidates">, policy: RotationPolicy, pseudonymizer: Pseudonymizer): SchedulePayload {
  return {
    slots: context.slots.map((s) => ({ function: s.function, count: s.count })),
    candidates: context.candidates.map((c) => ({
      token: pseudonymizer.tokenFor(c.ministryMembershipId),
      functions: [...c.functions],
      available: c.available,
      recent_by_function: { ...c.recentByFunction },
      scheduled_this_month: c.scheduledThisMonth,
    })),
    policy: { max_gap: policy.maxGap, max_per_month: policy.maxPerMonth, allow_multi_function: policy.allowMultiFunction },
  };
}

export interface ResolvedProposal {
  readonly proposal: readonly ProposedAssignment[];
  readonly rationale: ReadonlyMap<string, string>;
  readonly violations: readonly Violation[];
}

/** De-pseudonimiza a saída do modelo. Token desconhecido, função fora das vagas ou excesso de vagas nunca passam. */
export function resolveProposal(output: AiScheduleOutput, pseudonymizer: Pseudonymizer, slots: readonly Slot[]): ResolvedProposal {
  const proposal: ProposedAssignment[] = [];
  const rationale = new Map<string, string>();
  const violations: Violation[] = [];
  const used = new Map<string, number>();
  for (const item of output.assignments) {
    const id = pseudonymizer.resolve(item.token);
    if (id === null) {
      violations.push({ code: "UNKNOWN_MEMBER", severity: "error", ministryMembershipId: null, function: item.function, message: "A sugestão citou uma pessoa inexistente e foi descartada" });
      continue;
    }
    const slot = slots.find((s) => norm(s.function) === norm(item.function));
    if (slot === undefined) {
      violations.push({ code: "FUNCTION_NOT_SUPPORTED", severity: "error", ministryMembershipId: id, function: item.function, message: `Função "${item.function}" não foi pedida` });
      continue;
    }
    const count = used.get(slot.function) ?? 0;
    if (count >= slot.count) {
      violations.push({ code: "SLOT_EXCEEDED", severity: "warning", ministryMembershipId: id, function: slot.function, message: `Mais pessoas que as ${slot.count} vaga(s) de "${slot.function}": excedente descartado` });
      continue;
    }
    used.set(slot.function, count + 1);
    proposal.push({ ministryMembershipId: id, function: slot.function });
    if (item.rationale !== undefined) rationale.set(`${id}|${norm(slot.function)}`, item.rationale);
  }
  return { proposal, rationale, violations };
}
