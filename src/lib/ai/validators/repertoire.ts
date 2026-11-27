import { REPERTOIRE_LIMITS } from "@/lib/ai/config";
import type { AiRepertoireOutput } from "@/lib/ai/schemas/repertoire";

/** Música elegível como o validador a enxerga (o token é o mesmo enviado ao modelo). */
export interface EligibleSong {
  readonly token: string;
  readonly versionId: string;
  readonly title: string;
  readonly artist: string | null;
  readonly key: string;
  readonly lastUsedDays: number | null;
}

export interface RepertoireIssue { readonly code: string; readonly message: string }

export interface ValidatedRepertoire {
  readonly status: "validated" | "validation_failed";
  readonly accepted: readonly { song_version_id: string; position: number; title: string; artist: string | null; key: string; reason: string | null }[];
  readonly newSongs: readonly { title: string; artist: string | null; reason: string | null }[];
  readonly violations: readonly RepertoireIssue[];
  readonly warnings: readonly RepertoireIssue[];
}

const CONTROL = /[\u0000-\u001f\u007f]/g;
/** Texto curto vindo do modelo: sem controle, sem links, sem marcação de acorde, tamanho limitado. */
function cleanText(value: string | undefined, max: number): string | null {
  if (value === undefined) return null;
  const text = value.replace(CONTROL, " ").replace(/\s+/g, " ").trim();
  if (text.length === 0 || /https?:\/\/|www\./i.test(text)) return null;
  return text.slice(0, max);
}
/** Título/artista de música sugerida: letras, números e pontuação simples. Recusa colchetes (cifra) e textos longos. */
const NAME = /^[\p{L}\p{N}][\p{L}\p{N} '’.,&!?()\-–:/]{0,119}$/u;
function cleanName(value: string | undefined): string | null {
  const text = cleanText(value, 120);
  return text !== null && NAME.test(text) ? text : null;
}
function normalize(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Validação determinística da saída da IA (AI_ENGINE §1): o código decide, a IA só propõe. */
export function validateRepertoire(output: AiRepertoireOutput, eligible: readonly EligibleSong[]): ValidatedRepertoire {
  const byToken = new Map(eligible.map((s) => [s.token, s] as const));
  const violations: RepertoireIssue[] = [];
  const warnings: RepertoireIssue[] = [];
  const accepted: ValidatedRepertoire["accepted"][number][] = [];
  const seen = new Set<string>();

  for (const item of output.setlist) {
    const song = byToken.get(item.song);
    if (song === undefined) { violations.push({ code: "musica_desconhecida", message: `A IA citou uma música que não está no repertório da igreja (${item.song}).` }); continue; }
    if (seen.has(song.versionId)) { violations.push({ code: "musica_repetida", message: `"${song.title}" apareceu duas vezes.` }); continue; }
    seen.add(song.versionId);
    if (song.lastUsedDays !== null && song.lastUsedDays < REPERTOIRE_LIMITS.recentDays) {
      warnings.push({ code: "usada_recentemente", message: `"${song.title}" foi usada há ${song.lastUsedDays} dia(s).` });
    }
    accepted.push({ song_version_id: song.versionId, position: accepted.length, title: song.title, artist: song.artist, key: song.key, reason: cleanText(item.reason, 200) });
  }
  if (accepted.length < REPERTOIRE_LIMITS.minSongs) violations.push({ code: "poucas_musicas", message: `A sugestão tem ${accepted.length} música(s); o mínimo é ${REPERTOIRE_LIMITS.minSongs}.` });
  if (accepted.length > REPERTOIRE_LIMITS.maxSongs) violations.push({ code: "musicas_demais", message: `A sugestão tem ${accepted.length} músicas; o máximo é ${REPERTOIRE_LIMITS.maxSongs}.` });

  const known = new Set(eligible.map((s) => normalize(s.title)));
  const newSongs: ValidatedRepertoire["newSongs"][number][] = [];
  for (const s of output.new_songs) {
    const title = cleanName(s.title);
    if (title === null || known.has(normalize(title))) continue;
    known.add(normalize(title));
    newSongs.push({ title, artist: s.artist === undefined ? null : cleanName(s.artist), reason: cleanText(s.reason, 200) });
    if (newSongs.length === REPERTOIRE_LIMITS.maxNewSongs) break;
  }

  return { status: violations.length === 0 ? "validated" : "validation_failed", accepted, newSongs, violations, warnings };
}
