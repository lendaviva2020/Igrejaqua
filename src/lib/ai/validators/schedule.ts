/**
 * Camada determinística de validação (AI_ENGINE §4). O LLM nunca decide elegibilidade.
 * Entrada: proposta já des-pseudonimizada + fatos lidos do banco com o JWT do solicitante.
 */
export type ViolationCode =
  | "UNKNOWN_MEMBER"
  | "OTHER_CHURCH"
  | "INACTIVE"
  | "WRONG_MINISTRY"
  | "FUNCTION_NOT_SUPPORTED"
  | "UNAVAILABLE"
  | "DUPLICATE_ASSIGNMENT"
  | "OVERLAP"
  | "MONTHLY_LIMIT"
  | "ROTATION_GAP"
  | "SLOT_EXCEEDED"
  | "SESSION_INVALID";

export interface Violation {
  readonly code: ViolationCode;
  readonly severity: "error" | "warning";
  readonly ministryMembershipId: string | null;
  readonly function: string | null;
  readonly message: string;
}

export interface Candidate {
  readonly ministryMembershipId: string;
  readonly membershipId: string;
  readonly churchId: string;
  readonly ministryId: string;
  readonly active: boolean;
  readonly functions: readonly string[];
  /** Resultado de get_ministry_availability (apenas booleano). */
  readonly available: boolean;
  /** Escalas no mês da sessão (ativas), para R-14. */
  readonly scheduledThisMonth: number;
  /** Contagem recente por função na janela de rotação, para R-13. */
  readonly recentByFunction: Readonly<Record<string, number>>;
}

export interface ExistingAssignment {
  readonly membershipId: string;
  readonly sessionId: string;
  readonly startsAt: number; // epoch ms
  readonly endsAt: number;
}

export interface SessionFacts {
  readonly id: string;
  readonly churchId: string;
  readonly ministryId: string;
  readonly startsAt: number;
  readonly endsAt: number;
  readonly cancelled: boolean;
  readonly now: number;
}

export interface RotationPolicy {
  readonly maxGap: number;
  readonly maxPerMonth: number;
  readonly allowMultiFunction: boolean;
}

export interface ProposedAssignment {
  readonly ministryMembershipId: string;
  readonly function: string;
}

export interface ValidationReport {
  readonly ok: boolean;
  readonly accepted: readonly ProposedAssignment[];
  readonly violations: readonly Violation[];
}

const norm = (s: string): string => s.trim().toLocaleLowerCase("pt-BR");

export function validateSchedule(input: {
  readonly session: SessionFacts;
  readonly proposal: readonly ProposedAssignment[];
  readonly candidates: readonly Candidate[];
  readonly existing: readonly ExistingAssignment[];
  readonly policy: RotationPolicy;
}): ValidationReport {
  const { session, proposal, candidates, existing, policy } = input;
  const violations: Violation[] = [];
  const accepted: ProposedAssignment[] = [];
  const byId = new Map(candidates.map((c) => [c.ministryMembershipId, c] as const));

  if (session.cancelled || session.endsAt <= session.now || session.endsAt <= session.startsAt) {
    violations.push({ code: "SESSION_INVALID", severity: "error", ministryMembershipId: null, function: null, message: "Sessão cancelada, passada ou com horário inválido" });
    return { ok: false, accepted: [], violations };
  }

  const seen = new Set<string>();
  const perPerson = new Map<string, number>();

  for (const item of proposal) {
    const fail = (code: ViolationCode, message: string, severity: "error" | "warning" = "error"): boolean => {
      violations.push({ code, severity, ministryMembershipId: item.ministryMembershipId, function: item.function, message });
      return severity === "error";
    };
    const candidate = byId.get(item.ministryMembershipId);
    if (candidate === undefined) {
      fail("UNKNOWN_MEMBER", "Membro inexistente no conjunto elegível");
      continue;
    }
    if (candidate.churchId !== session.churchId) {
      fail("OTHER_CHURCH", "Membro pertence a outra igreja");
      continue;
    }
    if (!candidate.active) {
      fail("INACTIVE", "Membro inativo na igreja ou no ministério");
      continue;
    }
    if (candidate.ministryId !== session.ministryId) {
      fail("WRONG_MINISTRY", "Membro não pertence ao ministério da sessão");
      continue;
    }
    if (!candidate.functions.some((f) => norm(f) === norm(item.function))) {
      fail("FUNCTION_NOT_SUPPORTED", `Membro não atua na função "${item.function}"`);
      continue;
    }
    if (!candidate.available) {
      fail("UNAVAILABLE", "Membro indisponível na data");
      continue;
    }
    const key = `${item.ministryMembershipId}|${norm(item.function)}`;
    const personAlready = perPerson.get(item.ministryMembershipId) ?? 0;
    if (seen.has(key) || (personAlready > 0 && !policy.allowMultiFunction)) {
      fail("DUPLICATE_ASSIGNMENT", "Pessoa já escalada nesta sessão");
      continue;
    }
    const clash = existing.some(
      (e) => e.membershipId === candidate.membershipId && e.sessionId !== session.id && e.startsAt < session.endsAt && session.startsAt < e.endsAt,
    );
    if (clash) {
      fail("OVERLAP", "Pessoa já escalada em sessão sobreposta");
      continue;
    }
    if (candidate.scheduledThisMonth + 1 > policy.maxPerMonth) {
      fail("MONTHLY_LIMIT", `Limite mensal de ${policy.maxPerMonth} escalas excedido`);
      continue;
    }
    // R-13: aviso (não bloqueante) quando a pessoa já está acima do menos escalado da função
    const sameFunction = candidates.filter((c) => c.active && c.functions.some((f) => norm(f) === norm(item.function)));
    const counts = sameFunction.map((c) => c.recentByFunction[item.function] ?? 0);
    const mine = candidate.recentByFunction[item.function] ?? 0;
    if (counts.length > 0 && mine + 1 - Math.min(...counts) > policy.maxGap) {
      fail("ROTATION_GAP", "Distribuição desigual: há pessoas menos escaladas nesta função", "warning");
    }
    seen.add(key);
    perPerson.set(item.ministryMembershipId, personAlready + 1);
    accepted.push(item);
  }

  const hasError = violations.some((v) => v.severity === "error");
  return { ok: !hasError, accepted, violations };
}
