/**
 * Teoria musical determinística (ADR-0007).
 * Funções puras, sem dependências: usadas no servidor e no Stage Mode offline.
 */

export type Accidental = "#" | "b";

/** Pitch classes 0..11 a partir de C. */
const NATURAL_PC: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;

/** Tonalidades maiores que, por convenção, usam bemóis. */
const FLAT_MAJOR_TONICS = new Set([5, 10, 3, 8, 1, 6]); // F, Bb, Eb, Ab, Db, Gb
/** Tonalidades menores que usam bemóis (relativas): Dm, Gm, Cm, Fm, Bbm, Ebm. */
const FLAT_MINOR_TONICS = new Set([2, 7, 0, 5, 10, 3]);

export class MusicTheoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MusicTheoryError";
  }
}

export interface ParsedNote {
  readonly pitchClass: number;
}

/** Converte "C", "F#", "Bb" em pitch class (0..11). */
export function noteToPitchClass(note: string): number {
  const match = /^([A-G])([#b]?)$/.exec(note);
  if (!match) throw new MusicTheoryError(`Nota inválida: "${note}"`);
  const letter = match[1] as string;
  const accidental = match[2] as string;
  const base = NATURAL_PC[letter];
  if (base === undefined) throw new MusicTheoryError(`Nota inválida: "${note}"`);
  const shift = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  return (((base + shift) % 12) + 12) % 12;
}

export interface Key {
  readonly tonic: number;
  readonly minor: boolean;
}

/** "G", "F#m", "Bb" → Key. */
export function parseKey(key: string): Key {
  const match = /^([A-G][#b]?)(m?)$/.exec(key);
  if (!match) throw new MusicTheoryError(`Tonalidade inválida: "${key}"`);
  return { tonic: noteToPitchClass(match[1] as string), minor: match[2] === "m" };
}

/** Define se a grafia de uma tonalidade-alvo deve usar bemóis. */
export function prefersFlats(key: Key): boolean {
  return key.minor ? FLAT_MINOR_TONICS.has(key.tonic) : FLAT_MAJOR_TONICS.has(key.tonic);
}

export function pitchClassToName(pitchClass: number, useFlats: boolean): string {
  const index = ((pitchClass % 12) + 12) % 12;
  const table = useFlats ? FLAT_NAMES : SHARP_NAMES;
  const name = table[index];
  if (name === undefined) throw new MusicTheoryError(`Pitch class inválido: ${pitchClass}`);
  return name;
}

/** Menor deslocamento (em semitons, -5..+6) para ir de `from` a `to`. */
export function semitonesBetween(from: string, to: string): number {
  const a = parseKey(from);
  const b = parseKey(to);
  const diff = (((b.tonic - a.tonic) % 12) + 12) % 12;
  return diff > 6 ? diff - 12 : diff;
}

/** Nome da tonalidade com a grafia adequada. */
export function keyName(key: Key): string {
  return pitchClassToName(key.tonic, prefersFlats(key)) + (key.minor ? "m" : "");
}

/** Transpõe uma tonalidade por N semitons. */
export function transposeKey(key: string, semitones: number): string {
  const parsed = parseKey(key);
  const next: Key = { tonic: (((parsed.tonic + semitones) % 12) + 12) % 12, minor: parsed.minor };
  return keyName(next);
}

export interface ParsedChord {
  readonly root: string;
  readonly quality: string;
  readonly bass: string | null;
}

/**
 * Decompõe um acorde: raiz + qualidade/extensões + baixo opcional.
 * Aceita Cmaj7, F#m7b5, Dsus4, G/B, Am7/G, C#dim, Bbadd9.
 */
export function parseChord(chord: string): ParsedChord | null {
  const match = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(chord.trim());
  if (!match) return null;
  return { root: match[1] as string, quality: match[2] ?? "", bass: match[3] ?? null };
}

/** Transpõe um acorde. Acordes não reconhecidos são devolvidos intactos (ex.: "N.C."). */
export function transposeChord(chord: string, semitones: number, useFlats: boolean): string {
  const parsed = parseChord(chord);
  if (!parsed) return chord;
  const root = pitchClassToName(noteToPitchClass(parsed.root) + semitones, useFlats);
  const bass = parsed.bass === null ? "" : `/${pitchClassToName(noteToPitchClass(parsed.bass) + semitones, useFlats)}`;
  return `${root}${parsed.quality}${bass}`;
}

/** Distância no círculo das quintas entre duas tonalidades (0..6), ignorando modo. */
export function circleOfFifthsDistance(a: string, b: string): number {
  const toFifths = (pc: number): number => (pc * 7) % 12;
  const ka = parseKey(a);
  const kb = parseKey(b);
  // Relativa menor compartilha armadura com a maior (menor = tônica + 3 semitons).
  const ra = ka.minor ? (ka.tonic + 3) % 12 : ka.tonic;
  const rb = kb.minor ? (kb.tonic + 3) % 12 : kb.tonic;
  const d = Math.abs(toFifths(ra) - toFifths(rb));
  return Math.min(d, 12 - d);
}

export interface VocalRange {
  readonly low: number; // nota MIDI mais grave confortável
  readonly high: number; // nota MIDI mais aguda confortável
}

export interface MelodyRange {
  readonly low: number;
  readonly high: number;
}

export interface VocalKeyRecommendation {
  readonly targetKey: string;
  readonly semitones: number;
  /** true se a melodia inteira cabe na extensão vocal (com 1 semitom de folga). */
  readonly fits: boolean;
  /** Semitons que ainda excedem a extensão (0 quando cabe). */
  readonly violation: number;
}

/**
 * R-18: escolhe o tom que mantém a melodia dentro de [low+1, high−1].
 * Se nenhum couber, devolve o de menor violação; empate → menor transposição absoluta.
 * Totalmente determinístico: a IA apenas explica o resultado.
 */
export function recommendVocalKey(originalKey: string, melody: MelodyRange, voice: VocalRange): VocalKeyRecommendation {
  if (melody.low > melody.high || voice.low > voice.high) {
    throw new MusicTheoryError("Faixa inválida: low deve ser <= high");
  }
  const original = parseKey(originalKey);
  let best: VocalKeyRecommendation | null = null;
  for (let shift = -6; shift <= 6; shift += 1) {
    const lowAfter = melody.low + shift;
    const highAfter = melody.high + shift;
    const under = Math.max(0, voice.low + 1 - lowAfter);
    const over = Math.max(0, highAfter - (voice.high - 1));
    const violation = under + over;
    const candidate: VocalKeyRecommendation = {
      targetKey: keyName({ tonic: (((original.tonic + shift) % 12) + 12) % 12, minor: original.minor }),
      semitones: shift,
      fits: violation === 0,
      violation,
    };
    if (
      best === null ||
      candidate.violation < best.violation ||
      (candidate.violation === best.violation && Math.abs(candidate.semitones) < Math.abs(best.semitones))
    ) {
      best = candidate;
    }
  }
  if (best === null) throw new MusicTheoryError("Sem candidato de tonalidade");
  return best;
}
