import { convertChordSheet, isChordLine, normalizeKey } from "./chord-sheet";

/**
 * Extração de uma música a partir do conteúdo de uma página (HTML) ou arquivo de texto.
 * Independente de site: o bloco de cifra é escolhido pelo padrão musical (linhas de acordes), não
 * por classe CSS. Padrões conhecidos dos sites de cifra brasileiros ("tom: G", "capotraste na 2ª
 * casa", og:title "Música - Artista - Site") são usados quando presentes.
 */

export type ImportWarning =
  | "key-estimated"      // tom deduzido do primeiro acorde
  | "key-missing"        // nenhum tom reconhecido
  | "no-chords"          // a página não tem cifra reconhecível (só título/artista)
  | "tabs-removed"       // tablaturas removidas
  | "capo"               // a página indica capotraste
  | "artist-missing";

export interface ImportedSong {
  readonly title: string | null;
  readonly artist: string | null;
  readonly key: string | null;
  readonly bpm: number | null;
  readonly capo: number | null;
  readonly chordpro: string;
  readonly warnings: readonly ImportWarning[];
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ccedil: "ç", Ccedil: "Ç", atilde: "ã", otilde: "õ", aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", acirc: "â", ecirc: "ê", ocirc: "ô", agrave: "à", Aacute: "Á", Eacute: "É", Atilde: "Ã", ordf: "ª", ordm: "º", deg: "°", hellip: "…", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”" };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) {
      const n = Number.parseInt(code.slice(2), 16);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole;
    }
    if (code.startsWith("#")) {
      const n = Number.parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole;
    }
    return NAMED_ENTITIES[code] ?? whole;
  });
}

/** Remove tags preservando quebras de linha de <br>; o texto resultante é tratado como texto puro. */
function stripTags(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, ""));
}

function clean(value: string | null | undefined, max = 200): string | null {
  if (value === null || value === undefined) return null;
  const v = value.replace(/\s+/g, " ").trim();
  return v === "" ? null : v.slice(0, max);
}

function metaContent(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const a = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`, "i").exec(html);
  const b = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`, "i").exec(html);
  return clean(decodeEntities(a?.[1] ?? b?.[1] ?? ""));
}

interface JsonLdSong { readonly title: string | null; readonly artist: string | null }

function nameOf(value: unknown): string | null {
  if (typeof value === "string") return clean(value);
  if (Array.isArray(value)) return nameOf(value[0]);
  if (value !== null && typeof value === "object" && "name" in value) return nameOf((value as { name: unknown }).name);
  return null;
}

/** Dados estruturados schema.org de música (MusicComposition / MusicRecording), se houver. */
function fromJsonLd(html: string): JsonLdSong | null {
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const block of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(block[1] ?? "");
    } catch {
      continue;
    }
    const nodes: unknown[] = Array.isArray(data) ? data : data !== null && typeof data === "object" && "@graph" in data ? ((data as { "@graph": unknown })["@graph"] as unknown[]) : [data];
    for (const node of Array.isArray(nodes) ? nodes : []) {
      if (node === null || typeof node !== "object") continue;
      const type = (node as { "@type"?: unknown })["@type"];
      const types = Array.isArray(type) ? type : [type];
      if (!types.some((t) => t === "MusicComposition" || t === "MusicRecording")) continue;
      const n = node as Record<string, unknown>;
      return { title: nameOf(n["name"]), artist: nameOf(n["byArtist"]) ?? nameOf(n["composer"]) ?? nameOf(n["lyricist"]) };
    }
  }
  return null;
}

/** "Música - Artista - Site" / "Música | Artista" → partes. */
function splitTitle(raw: string | null): { title: string | null; artist: string | null } {
  if (raw === null) return { title: null, artist: null };
  const parts = raw.split(/\s+[-–|]\s+/).map((p) => p.trim()).filter((p) => p !== "");
  // Sufixos que não são nome de música nem de artista.
  const meaningful = parts.filter((p) => !/^(cifra club|cifras?|letras?(\.mus\.br)?|youtube|spotify|ouvir|ver cifra)$/i.test(p) && !/\.(com|br|net|org)/i.test(p));
  return { title: clean(meaningful[0] ?? null), artist: clean(meaningful[1] ?? null) };
}

function firstTagText(html: string, tag: "h1" | "h2" | "title"): string | null {
  const m = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(html);
  return clean(stripTags(m?.[1] ?? ""));
}

/** Escolhe o <pre> com mais linhas de acordes (a cifra). */
function bestPreBlock(html: string): string | null {
  let best: { text: string; score: number } | null = null;
  for (const m of html.matchAll(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi)) {
    const text = stripTags(m[1] ?? "");
    const score = convertChordSheet(text).chordLines;
    if (score >= 2 && (best === null || score > best.score)) best = { text, score };
  }
  return best?.text ?? null;
}

// Sem a flag i de propósito: a tônica é maiúscula ("tom: G"); com i, "meio tom acima" viraria tom A.
const KEY_IN_TEXT = /\b[Tt]om(?:\s+original)?\s*[:\-]?\s*(?:<[^>]*>\s*)*([A-G][#b]?m?)(?![a-zA-Z#])/;
const CAPO_IN_TEXT = /capotraste\s+na\s+(\d{1,2})\s*[ªa°º]?\s*casa|\bcapo(?:traste)?\s*[:\-]?\s*(\d{1,2})\b/i;
const BPM_IN_TEXT = /\b(\d{2,3})\s*bpm\b|\bbpm\s*[:\-]?\s*(\d{2,3})\b/i;

function numberIn(match: RegExpExecArray | null, min: number, max: number): number | null {
  const raw = match?.[1] ?? match?.[2];
  if (raw === undefined) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/** Linhas de metadados dentro da cifra ("Tom: G", "Capotraste na 2ª casa") não fazem parte da música. */
function stripMetaLines(text: string): string {
  return text.split("\n").filter((l) => !/^\s*(tom|capotraste|capo|afinação|bpm)\b.*$/i.test(l)).join("\n");
}

function assemble(input: { title: string | null; artist: string | null; pageKey: string | null; bpm: number | null; capo: number | null; sheet: string | null }): ImportedSong {
  const warnings: ImportWarning[] = [];
  let chordpro = "";
  let key = input.pageKey !== null ? normalizeKey(input.pageKey) : null;
  if (input.sheet !== null) {
    const converted = convertChordSheet(stripMetaLines(input.sheet));
    chordpro = converted.chordpro;
    if (converted.removedTabLines > 0) warnings.push("tabs-removed");
    if (key === null && converted.firstChord !== null) {
      key = normalizeKey(converted.firstChord);
      if (key !== null) warnings.push("key-estimated");
    }
  } else {
    warnings.push("no-chords");
  }
  if (key === null) warnings.push("key-missing");
  if (input.capo !== null && input.capo > 0) {
    warnings.push("capo");
    chordpro = `{comment: Capotraste na ${input.capo}ª casa}\n${chordpro}`.trim();
  }
  if (input.artist === null) warnings.push("artist-missing");
  return { title: input.title, artist: input.artist, key, bpm: input.bpm, capo: input.capo, chordpro, warnings };
}

/** Extrai a música de uma página HTML. */
export function extractSongFromHtml(html: string): ImportedSong {
  const head = html.slice(0, 200_000);
  const ld = fromJsonLd(head);
  const og = splitTitle(metaContent(head, "og:title"));
  const doc = splitTitle(firstTagText(head, "title"));
  const h1 = firstTagText(html, "h1");
  const sheet = bestPreBlock(html);
  const visible = stripTags(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ""));
  const pageKeyMatch = KEY_IN_TEXT.exec(html.replace(/<script[\s\S]*?<\/script>/gi, ""));
  return assemble({
    title: ld?.title ?? og.title ?? h1 ?? doc.title,
    artist: ld?.artist ?? og.artist ?? doc.artist,
    pageKey: pageKeyMatch?.[1] ?? null,
    bpm: numberIn(BPM_IN_TEXT.exec(visible), 30, 300),
    capo: numberIn(CAPO_IN_TEXT.exec(visible), 1, 11),
    sheet,
  });
}

/** Extrai a música de um arquivo de texto (.txt, .cho, .chordpro). */
export function extractSongFromText(text: string): ImportedSong {
  const title = /^\s*\{\s*(?:title|t)\s*:\s*(.+?)\s*\}\s*$/im.exec(text)?.[1] ?? null;
  const artist = /^\s*\{\s*(?:artist|subtitle|st)\s*:\s*(.+?)\s*\}\s*$/im.exec(text)?.[1] ?? null;
  const key = /^\s*\{\s*key\s*:\s*([A-G][#b]?m?)\s*\}\s*$/im.exec(text)?.[1] ?? KEY_IN_TEXT.exec(text)?.[1] ?? null;
  const body = text.split("\n").filter((l) => !/^\s*\{\s*(title|t|artist|subtitle|st|key)\s*:/i.test(l)).join("\n");
  return assemble({ title: clean(title), artist: clean(artist), pageKey: key, bpm: numberIn(BPM_IN_TEXT.exec(text), 30, 300), capo: numberIn(CAPO_IN_TEXT.exec(text), 1, 11), sheet: body.trim() === "" ? null : body });
}

/**
 * Cifra colada pela pessoa (copiada de qualquer site). Roda no navegador, sem rede.
 * Se o texto começar com até 3 linhas curtas antes da cifra (título, artista, "Tom: G"),
 * título e artista são aproveitados e saem do corpo.
 */
export function extractSongFromPaste(text: string): ImportedSong {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const firstMusicLine = lines.findIndex((l) => isChordLine(l) || /^\s*\[[^\]]{1,40}\]/.test(l) || /\[[A-G][#b]?[^\]\s]{0,10}\]/.test(l) || /^\s*\{/.test(l));
  let title: string | null = null;
  let artist: string | null = null;
  let body = text;
  if (firstMusicLine > 0) {
    const header = lines.slice(0, firstMusicLine).map((l) => l.trim()).filter((l) => l !== "" && !/^(tom|capotraste|capo|afinação|bpm)\b/i.test(l));
    if (header.length >= 1 && header.length <= 3 && header.every((l) => l.length <= 80)) {
      title = clean(header[0] ?? null);
      artist = clean(header[1] ?? null);
      // Mantém as linhas de metadados (tom/capo) para a detecção, descartando só título e artista.
      body = [...lines.slice(0, firstMusicLine).filter((l) => /^\s*(tom|capotraste|capo|bpm)\b/i.test(l)), ...lines.slice(firstMusicLine)].join("\n");
    }
  }
  const song = extractSongFromText(body);
  return { ...song, title: song.title ?? title, artist: song.artist ?? artist, warnings: song.warnings.filter((w) => w !== "artist-missing" || (song.artist ?? artist) === null) };
}
