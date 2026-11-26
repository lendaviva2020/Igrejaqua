/**
 * Parser e renderizador ChordPro mínimo e seguro (sem HTML bruto).
 * Suporta: {title}, {key}, {capo}, {tempo}, {comment}, {start_of_*}/{end_of_*} (verse/chorus/bridge),
 * e acordes inline [Am7]. Diretivas desconhecidas são ignoradas, nunca executadas.
 */
import { parseKey, prefersFlats, semitonesBetween, transposeChord } from "@/lib/music-theory";

export const MAX_CHORDPRO_BYTES = 64 * 1024;

export class ChordProError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChordProError";
  }
}

export interface ChordSegment {
  /** Acorde exibido acima do texto (null = só texto). */
  readonly chord: string | null;
  /** Texto cantado a partir deste acorde. */
  readonly text: string;
}

export type SectionKind = "verse" | "chorus" | "bridge" | "intro" | "outro" | "other";

export interface ChordLine {
  readonly kind: "lyrics" | "comment" | "blank";
  readonly segments: readonly ChordSegment[];
}

export interface Section {
  readonly kind: SectionKind;
  readonly label: string | null;
  readonly lines: readonly ChordLine[];
}

export interface ParsedSong {
  readonly title: string | null;
  readonly key: string | null;
  readonly capo: number | null;
  readonly tempo: number | null;
  readonly sections: readonly Section[];
}

const SECTION_KINDS: Readonly<Record<string, SectionKind>> = {
  verse: "verse",
  chorus: "chorus",
  bridge: "bridge",
  intro: "intro",
  outro: "outro",
};

function parseLyricLine(raw: string): readonly ChordSegment[] {
  const segments: ChordSegment[] = [];
  const pattern = /\[([^\]\n]{1,20})\]/g;
  let cursor = 0;
  let pendingChord: string | null = null;
  let match: RegExpExecArray | null = pattern.exec(raw);
  while (match !== null) {
    const before = raw.slice(cursor, match.index);
    if (before.length > 0 || pendingChord !== null) {
      segments.push({ chord: pendingChord, text: before });
    }
    pendingChord = (match[1] as string).trim();
    cursor = match.index + match[0].length;
    match = pattern.exec(raw);
  }
  const tail = raw.slice(cursor);
  if (tail.length > 0 || pendingChord !== null || segments.length === 0) {
    segments.push({ chord: pendingChord, text: tail });
  }
  return segments;
}

export function parseChordPro(source: string): ParsedSong {
  if (new TextEncoder().encode(source).length > MAX_CHORDPRO_BYTES) {
    throw new ChordProError(`Cifra excede ${MAX_CHORDPRO_BYTES} bytes`);
  }
  let title: string | null = null;
  let key: string | null = null;
  let capo: number | null = null;
  let tempo: number | null = null;
  const sections: Section[] = [];
  let current: { kind: SectionKind; label: string | null; lines: ChordLine[] } = { kind: "other", label: null, lines: [] };

  const flush = (): void => {
    if (current.lines.length > 0) sections.push({ kind: current.kind, label: current.label, lines: current.lines });
  };

  for (const rawLine of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    const directive = /^\{\s*([a-zA-Z_]+)\s*(?::\s*(.*?))?\s*\}$/.exec(line);
    if (directive) {
      const name = (directive[1] as string).toLowerCase();
      const value = directive[2] ?? "";
      if (name === "title" || name === "t") title = value || null;
      else if (name === "key") key = /^[A-G][#b]?m?$/.test(value) ? value : null;
      else if (name === "capo") {
        const n = Number.parseInt(value, 10);
        capo = Number.isInteger(n) && n >= 0 && n <= 11 ? n : null;
      } else if (name === "tempo" || name === "bpm") {
        const n = Number.parseInt(value, 10);
        tempo = Number.isInteger(n) && n >= 30 && n <= 300 ? n : null;
      } else if (name === "comment" || name === "c") {
        current.lines.push({ kind: "comment", segments: [{ chord: null, text: value }] });
      } else if (name.startsWith("start_of_") || name === "sov" || name === "soc" || name === "sob") {
        flush();
        const kindName = name.startsWith("start_of_") ? name.slice("start_of_".length) : { sov: "verse", soc: "chorus", sob: "bridge" }[name] ?? "other";
        current = { kind: SECTION_KINDS[kindName] ?? "other", label: value || null, lines: [] };
      } else if (name.startsWith("end_of_") || name === "eov" || name === "eoc" || name === "eob") {
        flush();
        current = { kind: "other", label: null, lines: [] };
      }
      continue; // diretivas desconhecidas são ignoradas
    }
    if (line.trim() === "") {
      current.lines.push({ kind: "blank", segments: [] });
      continue;
    }
    current.lines.push({ kind: "lyrics", segments: parseLyricLine(line) });
  }
  flush();
  return { title, key, capo, tempo, sections };
}

/**
 * R-16/R-17: transpõe a música (tonalidade original → alvo). A grafia segue a tonalidade-alvo.
 * Não altera o texto armazenado; devolve nova estrutura.
 */
export function transposeSong(song: ParsedSong, originalKey: string, targetKey: string): ParsedSong {
  const semitones = semitonesBetween(originalKey, targetKey);
  const useFlats = prefersFlats(parseKey(targetKey));
  return {
    ...song,
    key: targetKey,
    sections: song.sections.map((section) => ({
      ...section,
      lines: section.lines.map((line) => ({
        ...line,
        segments: line.segments.map((segment) => ({
          chord: segment.chord === null ? null : transposeChord(segment.chord, semitones, useFlats),
          text: segment.text,
        })),
      })),
    })),
  };
}

/** Serializa de volta para ChordPro (útil para exportação e testes de ida-e-volta). */
export function serializeChordPro(song: ParsedSong): string {
  const out: string[] = [];
  if (song.title !== null) out.push(`{title: ${song.title}}`);
  if (song.key !== null) out.push(`{key: ${song.key}}`);
  if (song.capo !== null) out.push(`{capo: ${song.capo}}`);
  if (song.tempo !== null) out.push(`{tempo: ${song.tempo}}`);
  for (const section of song.sections) {
    const labelled = section.kind !== "other";
    if (labelled) out.push(`{start_of_${section.kind}${section.label ? `: ${section.label}` : ""}}`);
    for (const line of section.lines) {
      if (line.kind === "blank") out.push("");
      else if (line.kind === "comment") out.push(`{comment: ${line.segments.map((s) => s.text).join("")}}`);
      else out.push(line.segments.map((s) => (s.chord === null ? s.text : `[${s.chord}]${s.text}`)).join(""));
    }
    if (labelled) out.push(`{end_of_${section.kind}}`);
  }
  return out.join("\n");
}
