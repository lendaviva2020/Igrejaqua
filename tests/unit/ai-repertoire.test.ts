import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AiUnavailableError, type AiClient } from "@/lib/ai/client";
import { buildRepertoirePrompt } from "@/lib/ai/prompts/repertoire";
import { buildRepertoirePayload, runRepertoireJob, type RepertoireContext, type RepertoireRecord, type RepertoireStore } from "@/lib/ai/repertoire";
import { parseAiRepertoireOutput } from "@/lib/ai/schemas/repertoire";
import { validateRepertoire, type EligibleSong } from "@/lib/ai/validators/repertoire";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const song = (n: number, title: string, lastUsedDays: number | null = null) => ({
  version_id: uuid(n), title, artist: "Ministério Teste", key: "G", bpm: 72, duration_s: 300, tags: ["adoração"], last_used_days: lastUsedDays,
});
const ctx = (songs: RepertoireContext["songs"]): RepertoireContext => ({
  session_id: uuid(900), church_id: uuid(901), session_name: "Principal", event_title: "Culto de domingo", event_kind: "service",
  starts_local: "2026-11-29T19:00", duration_min: 120, theme: { title: "Fé que persevera", scripture_ref: "Hebreus 11" }, songs,
});
const eligible: EligibleSong[] = [
  { token: "S01", versionId: uuid(1), title: "Canção A", artist: null, key: "G", lastUsedDays: null },
  { token: "S02", versionId: uuid(2), title: "Canção B", artist: null, key: "D", lastUsedDays: 3 },
  { token: "S03", versionId: uuid(3), title: "Canção C", artist: null, key: "E", lastUsedDays: 40 },
  { token: "S04", versionId: uuid(4), title: "Canção D", artist: null, key: "A", lastUsedDays: null },
];

describe("prompt de repertório", () => {
  it("proíbe letra e cifra e não leva ids do banco nem pessoas", () => {
    const { payload } = buildRepertoirePayload(ctx([song(1, "Canção A"), song(2, "Canção B"), song(3, "Canção C")]));
    const [system, user] = buildRepertoirePrompt(payload);
    expect(system!.content).toContain("NUNCA escreva letra");
    expect(user!.content).not.toContain(uuid(1));
    expect(user!.content).toContain('"token":"S01"');
    expect(user!.content).not.toMatch(/membership|user_id|e-mail|email/i);
  });
});

describe("parseAiRepertoireOutput", () => {
  it("aceita JSON (inclusive com cerca de código) e recusa campos extras", () => {
    expect(parseAiRepertoireOutput('```json\n{"setlist":[{"song":"S01"}]}\n```').ok).toBe(true);
    expect(parseAiRepertoireOutput('{"setlist":[{"song":"S01","lyrics":"..."}]}').ok).toBe(false);
    expect(parseAiRepertoireOutput("isto não é json").ok).toBe(false);
  });
});

describe("validateRepertoire", () => {
  it("valida um setlist bom, avisa sobre música recente e limpa sugestões novas", () => {
    const v = validateRepertoire({
      setlist: [{ song: "S01", reason: "abre bem" }, { song: "S02" }, { song: "S03" }],
      new_songs: [
        { title: "Canção A", artist: "X" },
        { title: "Nova Música", artist: "Banda Y", reason: "fala de fé" },
        { title: "[G] Letra com cifra [D]" },
        { title: "Veja https://exemplo.test" },
      ],
    }, eligible);
    expect(v.status).toBe("validated");
    expect(v.accepted.map((a) => a.song_version_id)).toEqual([uuid(1), uuid(2), uuid(3)]);
    expect(v.accepted.map((a) => a.position)).toEqual([0, 1, 2]);
    expect(v.warnings.map((w) => w.code)).toEqual(["usada_recentemente"]);
    expect(v.newSongs).toEqual([{ title: "Nova Música", artist: "Banda Y", reason: "fala de fé" }]);
  });
  it("reprova música inventada, repetida ou setlist curto", () => {
    const v = validateRepertoire({ setlist: [{ song: "S01" }, { song: "S01" }, { song: "S99" }], new_songs: [] }, eligible);
    expect(v.status).toBe("validation_failed");
    expect(v.violations.map((x) => x.code).sort()).toEqual(["musica_desconhecida", "musica_repetida", "poucas_musicas"]);
  });
});

function fakeStore(contexts: Record<string, RepertoireContext | null>): RepertoireStore & { records: RepertoireRecord[] } {
  const records: RepertoireRecord[] = [];
  return {
    records,
    async dueSessions() { return Object.keys(contexts).map((sessionId) => ({ sessionId, churchId: uuid(901) })); },
    async context(sessionId) { return contexts[sessionId] ?? null; },
    async record(run) { records.push(run); return uuid(800 + records.length); },
  };
}
const client = (text: string): AiClient => ({ complete: vi.fn(async () => ({ text, model: "modelo-x", promptTokens: 10, completionTokens: 5 })) });

describe("runRepertoireJob", () => {
  it("grava rascunho validado, pula sessão com poucas músicas e nunca chama a IA à toa", async () => {
    const store = fakeStore({
      [uuid(10)]: ctx([song(1, "Canção A"), song(2, "Canção B"), song(3, "Canção C")]),
      [uuid(11)]: ctx([song(1, "Canção A")]),
    });
    const ai = client('{"setlist":[{"song":"S03"},{"song":"S01"},{"song":"S02"}],"new_songs":[{"title":"Nova","artist":"Z"}]}');
    const summary = await runRepertoireJob({ store, client: ai });
    expect(summary).toEqual({ sessions: 2, validated: 1, failed: 0, skipped: 1, errors: 0 });
    expect(ai.complete).toHaveBeenCalledTimes(1);
    expect(store.records[0]!.status).toBe("validated");
    expect(store.records[0]!.promptVersion).toBe("repertoire-v1");
    expect((store.records[0]!.report as { accepted: { song_version_id: string }[] }).accepted.map((a) => a.song_version_id)).toEqual([uuid(3), uuid(1), uuid(2)]);
  });
  it("resposta fora do formato vira validation_failed; provedor fora do ar vira error e interrompe no circuito aberto", async () => {
    const songs = [song(1, "Canção A"), song(2, "Canção B"), song(3, "Canção C")];
    const bad = fakeStore({ [uuid(20)]: ctx(songs) });
    await runRepertoireJob({ store: bad, client: client("desculpe, não consigo") });
    expect(bad.records[0]!.status).toBe("validation_failed");

    const down = fakeStore({ [uuid(30)]: ctx(songs), [uuid(31)]: ctx(songs) });
    const failing: AiClient = { complete: vi.fn(async () => { throw new AiUnavailableError("circuit_open", "aberto"); }) };
    const summary = await runRepertoireJob({ store: down, client: failing });
    expect(summary.errors).toBe(1);
    expect(down.records).toHaveLength(1);
    expect(down.records[0]!.status).toBe("error");
  });
});
