import { MUSICAL_KEYS } from "../schemas";

/**
 * Conversão de cifras em texto ("acordes em cima da letra", formato dos sites de cifra brasileiros)
 * para ChordPro inline, que é o formato do repertório. Funções puras: sem rede, sem DOM.
 */

/** Acorde: tônica + qualidade/extensões + baixo opcional. Ex.: G, F#m7, C7M, Bb/D, E7(9), A4, Dº, G#m7(b5). */
const CHORD = /^[A-G][#b]?(?:m|M|maj|min|dim|aug|sus|add|º|°|\+|-|\d|\((?:[#b+-]?\d{1,2}[,/]?)+\)|[#b]\d{1,2})*(?:\/[A-G][#b]?)?$/;
/** Marcas que aparecem nas linhas de acordes sem serem acordes. */
const CHORD_LINE_NOISE = /^(?:\||\|\||-+|\(?\d+x\)?|x\d+|\.\.\.?|%)$/i;
/** Linha de tablatura (e|---3---|). Não vira cifra: é removida e gera aviso. */
const TAB_LINE = /^\s*[eBGDAEbgda]\|[-0-9|hpbrx~/\\.()* ]{3,}$/;
const SECTION_LINE = /^\s*\[([^\]]{1,40})\]\s*(.*)$/;
const DIRECTIVE_LINE = /^\s*\{[^}]*\}\s*$/;
const INLINE_CHORDPRO = /\[[A-G][#b]?[^\]\s]{0,10}\]/;

export function isChordToken(token: string): boolean {
  // "(G)" é acorde de passagem; já "E7(9)" tem o parêntese como parte do acorde.
  const t = /^\(.*\)$/.test(token) ? token.slice(1, -1) : token;
  return t.length > 0 && t.length <= 14 && CHORD.test(t);
}

/** Linha só de acordes (com marcas de repetição/compasso permitidas) e pelo menos um acorde. */
export function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter((t) => t !== "");
  if (tokens.length === 0) return false;
  let chords = 0;
  for (const token of tokens) {
    if (isChordToken(token)) chords += 1;
    else if (!CHORD_LINE_NOISE.test(token)) return false;
  }
  return chords > 0;
}

/** Posição (coluna) de cada acorde da linha, para encaixar na letra de baixo. */
function chordPositions(line: string): { col: number; chord: string }[] {
  const out: { col: number; chord: string }[] = [];
  const pattern = /\S+/g;
  let m: RegExpExecArray | null = pattern.exec(line);
  while (m !== null) {
    const token = m[0];
    if (isChordToken(token)) out.push({ col: m.index, chord: /^\(.*\)$/.test(token) ? token.slice(1, -1) : token });
    m = pattern.exec(line);
  }
  return out;
}

/** Insere [acorde] na letra na mesma coluna em que o acorde estava (da direita para a esquerda). */
function mergeChordsIntoLyric(chordLine: string, lyric: string): string {
  let text = lyric;
  const positions = chordPositions(chordLine);
  const last = positions[positions.length - 1];
  if (last !== undefined && last.col > text.length) text = text.padEnd(last.col, " ");
  for (let i = positions.length - 1; i >= 0; i -= 1) {
    const p = positions[i];
    if (p === undefined) continue;
    text = `${text.slice(0, p.col)}[${p.chord}]${text.slice(p.col)}`;
  }
  return text.trimEnd();
}

function chordsOnly(line: string): string {
  return chordPositions(line).map((p) => `[${p.chord}]`).join(" ");
}

function sectionComment(label: string): string {
  return `{comment: ${label.replace(/[{}]/g, "").trim()}}`;
}

export interface ConversionResult {
  readonly chordpro: string;
  readonly chordLines: number;
  readonly removedTabLines: number;
  readonly firstChord: string | null;
}

/**
 * Converte uma cifra em texto para ChordPro.
 * - linha de acordes seguida de letra → acordes encaixados na letra pela coluna;
 * - linha de acordes sozinha (introdução, solo) → "[G] [D] [Em]";
 * - "[Refrão]", "[Intro] G D" → comentário de seção (+ acordes);
 * - tablaturas são removidas (o repertório não as representa) e contadas para aviso.
 * Texto que já está em ChordPro (acordes entre colchetes na letra) é mantido como está.
 */
export function convertChordSheet(raw: string): ConversionResult {
  const lines = raw.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").replace(/ /g, " ").split("\n").map((l) => l.trimEnd());
  const alreadyChordPro = lines.some((l) => INLINE_CHORDPRO.test(l) && !SECTION_LINE.test(l)) || lines.some((l) => DIRECTIVE_LINE.test(l));
  let firstChord: string | null = null;
  const noteFirst = (line: string): void => {
    if (firstChord === null) firstChord = chordPositions(line)[0]?.chord ?? null;
  };

  if (alreadyChordPro) {
    const first = /\[([A-G][#b]?[^\]\s]{0,10})\]/.exec(raw);
    firstChord = first?.[1] ?? null;
    return { chordpro: lines.join("\n").trim(), chordLines: lines.filter((l) => INLINE_CHORDPRO.test(l)).length, removedTabLines: 0, firstChord };
  }

  const out: string[] = [];
  let chordLines = 0;
  let removedTabLines = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (TAB_LINE.test(line)) { removedTabLines += 1; continue; }

    const section = SECTION_LINE.exec(line);
    if (section !== null && !isChordToken(section[1] ?? "")) {
      out.push(sectionComment(section[1] ?? ""));
      const rest = section[2] ?? "";
      if (rest.trim() !== "" && isChordLine(rest)) { chordLines += 1; noteFirst(rest); out.push(chordsOnly(rest)); }
      else if (rest.trim() !== "") out.push(rest.trim());
      continue;
    }

    if (isChordLine(line)) {
      chordLines += 1;
      noteFirst(line);
      const next = lines[i + 1];
      const nextIsLyric = next !== undefined && next.trim() !== "" && !isChordLine(next) && !TAB_LINE.test(next) && SECTION_LINE.exec(next) === null;
      if (nextIsLyric) {
        out.push(mergeChordsIntoLyric(line, next));
        i += 1;
      } else {
        out.push(chordsOnly(line));
      }
      continue;
    }
    out.push(line);
  }
  // No máximo uma linha em branco seguida; sem brancos nas pontas.
  const compact = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { chordpro: compact, chordLines, removedTabLines, firstChord };
}

const ENHARMONIC: Readonly<Record<string, string>> = { "A#": "Bb", "D#": "Eb", "G#": "Ab", "Cb": "B", "Fb": "E", "E#": "F", "B#": "C" };
const ENHARMONIC_MINOR: Readonly<Record<string, string>> = { "A#m": "Bbm", "D#m": "Ebm", "Abm": "G#m", "Gbm": "F#m", "Dbm": "C#m", "Cbm": "Bm" };

/**
 * Normaliza um tom ou acorde para um dos tons aceitos pelo formulário (MUSICAL_KEYS).
 * Usa só tônica + menor: "F#m7" → "F#m", "A#" → "Bb", "C7M" → "C". Retorna null se não reconhecer.
 */
export function normalizeKey(value: string): string | null {
  const m = /^([A-G])([#b]?)(m(?!aj))?/.exec(value.trim());
  if (m === null) return null;
  const root = `${m[1] ?? ""}${m[2] ?? ""}`;
  const minor = m[3] !== undefined;
  const candidate = minor ? ENHARMONIC_MINOR[`${root}m`] ?? `${root}m` : ENHARMONIC[root] ?? root;
  return (MUSICAL_KEYS as readonly string[]).includes(candidate) ? candidate : null;
}
