import { describe, expect, it } from "vitest";
import { createPseudonymizer } from "@/lib/ai/pseudonymize";
import { parseAiScheduleOutput } from "@/lib/ai/schemas/schedule";
import { validateSchedule, type Candidate, type ExistingAssignment, type SessionFacts } from "@/lib/ai/validators/schedule";

const H = 3_600_000;
const NOW = Date.UTC(2027, 0, 1);
const session: SessionFacts = { id: "s1", churchId: "A", ministryId: "min", startsAt: NOW + 24 * H, endsAt: NOW + 26 * H, cancelled: false, now: NOW };
const policy = { maxGap: 2, maxPerMonth: 4, allowMultiFunction: false } as const;
const cand = (id: string, over: Partial<Candidate> = {}): Candidate => ({
  ministryMembershipId: id, membershipId: `p-${id}`, churchId: "A", ministryId: "min", active: true,
  functions: ["voz", "violão"], available: true, scheduledThisMonth: 0, recentByFunction: {}, ...over,
});
const run = (proposal: { ministryMembershipId: string; function: string }[], candidates: Candidate[], existing: ExistingAssignment[] = []) =>
  validateSchedule({ session, proposal, candidates, existing, policy });

describe("validateSchedule", () => {
  it("aceita proposta válida", () => {
    const r = run([{ ministryMembershipId: "a", function: "voz" }], [cand("a")]);
    expect(r.ok).toBe(true);
    expect(r.accepted).toHaveLength(1);
  });
  it("rejeita membro inexistente (alucinação)", () => {
    const r = run([{ ministryMembershipId: "fantasma", function: "voz" }], [cand("a")]);
    expect(r.ok).toBe(false);
    expect(r.violations[0]!.code).toBe("UNKNOWN_MEMBER");
    expect(r.accepted).toHaveLength(0);
  });
  it("rejeita membro de outra igreja, inativo e de outro ministério", () => {
    const r = run(
      [{ ministryMembershipId: "x", function: "voz" }, { ministryMembershipId: "y", function: "voz" }, { ministryMembershipId: "z", function: "voz" }],
      [cand("x", { churchId: "B" }), cand("y", { active: false }), cand("z", { ministryId: "outro" })],
    );
    expect(r.violations.map((v) => v.code)).toEqual(["OTHER_CHURCH", "INACTIVE", "WRONG_MINISTRY"]);
  });
  it("rejeita função incompatível e indisponível", () => {
    const r = run([{ ministryMembershipId: "a", function: "bateria" }, { ministryMembershipId: "b", function: "voz" }], [cand("a"), cand("b", { available: false })]);
    expect(r.violations.map((v) => v.code)).toEqual(["FUNCTION_NOT_SUPPORTED", "UNAVAILABLE"]);
  });
  it("evita duplicidade e permite múltiplas funções só se a política permitir", () => {
    const two = [{ ministryMembershipId: "a", function: "voz" }, { ministryMembershipId: "a", function: "violão" }];
    expect(run(two, [cand("a")]).violations.map((v) => v.code)).toContain("DUPLICATE_ASSIGNMENT");
    const permissive = validateSchedule({ session, proposal: two, candidates: [cand("a")], existing: [], policy: { ...policy, allowMultiFunction: true } });
    expect(permissive.ok).toBe(true);
  });
  it("detecta sobreposição com outra sessão e ignora sessão sem sobreposição", () => {
    const clash: ExistingAssignment = { membershipId: "p-a", sessionId: "s0", startsAt: session.startsAt + H, endsAt: session.endsAt + H };
    expect(run([{ ministryMembershipId: "a", function: "voz" }], [cand("a")], [clash]).violations[0]!.code).toBe("OVERLAP");
    const apart: ExistingAssignment = { membershipId: "p-a", sessionId: "s0", startsAt: session.endsAt, endsAt: session.endsAt + H };
    expect(run([{ ministryMembershipId: "a", function: "voz" }], [cand("a")], [apart]).ok).toBe(true);
  });
  it("aplica limite mensal", () => {
    expect(run([{ ministryMembershipId: "a", function: "voz" }], [cand("a", { scheduledThisMonth: 4 })]).violations[0]!.code).toBe("MONTHLY_LIMIT");
  });
  it("rotação desigual gera aviso não bloqueante", () => {
    const r = run([{ ministryMembershipId: "a", function: "voz" }], [cand("a", { recentByFunction: { voz: 5 } }), cand("b", { recentByFunction: { voz: 0 } })]);
    expect(r.ok).toBe(true);
    expect(r.violations[0]).toMatchObject({ code: "ROTATION_GAP", severity: "warning" });
  });
  it("sessão cancelada, passada ou inválida bloqueia tudo", () => {
    const base = { proposal: [{ ministryMembershipId: "a", function: "voz" }], candidates: [cand("a")], existing: [], policy };
    expect(validateSchedule({ ...base, session: { ...session, cancelled: true } }).ok).toBe(false);
    expect(validateSchedule({ ...base, session: { ...session, endsAt: NOW - H } }).ok).toBe(false);
  });
  it("itens inválidos são removidos, válidos permanecem", () => {
    const r = run([{ ministryMembershipId: "a", function: "voz" }, { ministryMembershipId: "ghost", function: "voz" }], [cand("a")]);
    expect(r.ok).toBe(false);
    expect(r.accepted).toEqual([{ ministryMembershipId: "a", function: "voz" }]);
  });
});

describe("parse da saída do LLM", () => {
  it("aceita JSON válido (inclusive em bloco markdown)", () => {
    const r = parseAiScheduleOutput('```json\n{"assignments":[{"token":"M01","function":"voz"}]}\n```');
    expect(r.ok).toBe(true);
  });
  it("rejeita campos extras, tokens malformados e texto livre", () => {
    expect(parseAiScheduleOutput('{"assignments":[{"token":"M01","function":"voz","name":"João"}]}').ok).toBe(false);
    expect(parseAiScheduleOutput('{"assignments":[{"token":"joao","function":"voz"}]}').ok).toBe(false);
    expect(parseAiScheduleOutput("Claro! Aqui está a escala").ok).toBe(false);
  });
});

describe("pseudonimização", () => {
  it("gera tokens estáveis e resolve apenas os emitidos", () => {
    const p = createPseudonymizer();
    const t1 = p.tokenFor("uuid-1");
    expect(t1).toBe("M01");
    expect(p.tokenFor("uuid-1")).toBe("M01");
    expect(p.tokenFor("uuid-2")).toBe("M02");
    expect(p.resolve("M02")).toBe("uuid-2");
    expect(p.resolve("M99")).toBeNull();
    expect(p.size).toBe(2);
  });
});
