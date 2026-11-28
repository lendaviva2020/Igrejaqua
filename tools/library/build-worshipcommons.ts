/**
 * Gera a Biblioteca aberta do repertório a partir de um clone do WorshipCommonsContent
 * (https://github.com/ChurchApps/WorshipCommonsContent): músicas com licença que permite o uso
 * pela igreja num sistema como o IGREJAQUA, com crédito e licença guardados em cada música.
 *
 * Uso:
 *   git clone --depth 1 https://github.com/ChurchApps/WorshipCommonsContent /tmp/wcc
 *   node --experimental-strip-types tools/library/build-worshipcommons.ts /tmp/wcc <commit> > src/modules/repertoire/library/worshipcommons.json
 *
 * Regras de inclusão (licenses/licenses.json do repositório de origem):
 *  - PD (domínio público), WC (WorshipCommons License: uso em culto, inclusive por ferramenta de
 *    projeção a serviço da igreja), CC-BY e CC-BY-SA (crédito + link da licença em cada cópia);
 *  - FICAM FORA: licenças não comerciais (NC) e personalizadas (ex.: "larry-holder", que proíbe
 *    site com fins lucrativos e tradução sem pedir);
 *  - FICAM FORA: músicas sem tom e sem acordes (o repertório exige tom; não inventamos).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ALLOWED = new Set(["PD", "WC", "CC-BY", "CC-BY-SA"]);
const KEY = /^[A-G][#b]?m?$/;
const ENHARMONIC: Readonly<Record<string, string>> = { "A#": "Bb", "D#": "Eb", "G#": "Ab", "A#m": "Bbm", "D#m": "Ebm", "Abm": "G#m", "Gbm": "F#m", "Dbm": "C#m", "Cb": "B", "Fb": "E", "E#": "F", "B#": "C" };
const LANGUAGE: Readonly<Record<string, string>> = { pt: "Português", es: "Espanhol", en: "Inglês", fr: "Francês", de: "Alemão", it: "Italiano", hu: "Húngaro", ru: "Russo", sq: "Albanês", ml: "Malaiala", nl: "Holandês", sv: "Sueco", ro: "Romeno", sk: "Eslovaco", la: "Latim", af: "Africâner", zh: "Chinês", zu: "Zulu", mt: "Maltês" };
const SECTION: ReadonlyArray<readonly [RegExp, string]> = [
  [/^verse$/i, "Estrofe"], [/^(chorus|refrain)$/i, "Refrão"], [/^bridge$/i, "Ponte"], [/^pre-?chorus$/i, "Pré-refrão"],
  [/^(coda|ending|outro)$/i, "Final"], [/^intro$/i, "Introdução"], [/^tag$/i, "Final"], [/^interlude$/i, "Interlúdio"],
];

export interface LibrarySong {
  readonly id: string;
  readonly title: string;
  readonly writer: string | null;
  readonly language: string;      // código (pt, en…)
  readonly languageName: string;  // nome em português
  readonly key: string;
  readonly keyEstimated: boolean;
  readonly bpm: number | null;
  readonly license: "PD" | "WC" | "CC-BY" | "CC-BY-SA";
  readonly licenseLabel: string;
  readonly copyrightNotice: string;
  readonly sourceUrl: string;
  readonly hasChords: boolean;
  readonly chordpro: string;
}

export interface LibraryFile {
  readonly source: { readonly repository: string; readonly commit: string; readonly generatedAt: string };
  readonly songs: readonly LibrarySong[];
}

interface SongJson { id?: string; title?: string; writer?: string | null; key?: string | null; bpm?: number | null; license?: string; licenseVersion?: string | null; licenseUrl?: string | null }
interface ManifestFile { file?: string; licenseBasis?: string | null }
interface SourceInfo { name?: string; url?: string; attribution?: { required?: boolean; text?: string; link?: string } }

function readJson<T>(path: string): T | null {
  try { return JSON.parse(readFileSync(path, "utf8")) as T; } catch { return null; }
}

function normalizeKey(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const m = /^([A-G])([#b]?)(m(?!aj))?/.exec(raw.trim());
  if (m === null) return null;
  const k = `${m[1] ?? ""}${m[2] ?? ""}${m[3] === undefined ? "" : "m"}`;
  const out = ENHARMONIC[k] ?? k;
  return KEY.test(out) ? out : null;
}

/** "Verse 1" → {comment: Estrofe 1}; tira diretivas que viram campos (título, artista, tom, tempo). */
export function normalizeChordPro(raw: string): string {
  const out: string[] = [];
  for (const line of raw.replace(/\r\n?/g, "\n").split("\n")) {
    const t = line.trim();
    if (/^\{\s*(title|t|artist|subtitle|st|key|time|tempo|bpm|composer|lyricist|copyright|ccli)\s*:/i.test(t)) continue;
    const sec = /^([A-Za-z-]+)(?:\s+(\d+))?:?$/.exec(t);
    const label = sec === null ? null : SECTION.find(([re]) => re.test(sec[1] ?? ""))?.[1] ?? null;
    if (sec !== null && label !== null) { out.push(`{comment: ${label}${sec[2] !== undefined ? ` ${sec[2]}` : ""}}`); continue; }
    out.push(line.trimEnd());
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function licenseLabel(license: string, version: string | null | undefined): string {
  if (license === "PD") return "Domínio público";
  if (license === "WC") return `WorshipCommons License ${version ?? "1.0"} (livre para culto)`;
  return `${license.replace("CC-", "CC ")} ${version ?? "4.0"}`;
}

function licenseUrl(license: string, version: string | null | undefined, songUrl: string | null | undefined): string | null {
  if (songUrl) return songUrl;
  const v = version ?? "4.0";
  if (license === "CC-BY") return `https://creativecommons.org/licenses/by/${v}/`;
  if (license === "CC-BY-SA") return `https://creativecommons.org/licenses/by-sa/${v}/`;
  if (license === "WC") return "https://worshipcommons.org/license";
  return null;
}

export function buildLibrary(root: string, commit: string): LibraryFile {
  const sources = readJson<Record<string, SourceInfo>>(join(root, "sources.json")) ?? {};
  const songs: LibrarySong[] = [];
  for (const lang of readdirSync(join(root, "songs")).sort()) {
    for (const dir of readdirSync(join(root, "songs", lang)).sort()) {
      const base = join(root, "songs", lang, dir);
      const song = readJson<SongJson>(join(base, "song.json"));
      const cpPath = join(base, "sources", "lyrics.chordpro");
      if (song === null || song.id === undefined || song.title === undefined || song.license === undefined || !existsSync(cpPath)) continue;
      if (!ALLOWED.has(song.license)) continue;
      const raw = readFileSync(cpPath, "utf8");
      const chordpro = normalizeChordPro(raw);
      if (chordpro === "") continue;
      const firstChord = /\[([A-G][#b]?[^\]\s]{0,10})\]/.exec(chordpro)?.[1] ?? null;
      const hasChords = firstChord !== null;
      const declared = normalizeKey(song.key) ?? normalizeKey(/^\{\s*key\s*:\s*([^}]+)\}/im.exec(raw)?.[1]);
      const estimated = declared === null ? normalizeKey(firstChord) : null;
      const key = declared ?? estimated;
      if (key === null) continue; // sem tom e sem acordes: não entra (não inventamos tom)

      const sourceUrl = `https://worshipcommons.org/songs/${song.id}`;
      // Fontes que exigem crédito (ex.: The Cyber Hymnal), conforme o manifest da letra.
      const manifest = readJson<{ files?: ManifestFile[] }>(join(base, "sources", "manifest.json"));
      const basis = manifest?.files?.find((f) => f.file === "lyrics.chordpro")?.licenseBasis ?? null;
      const src = basis === null ? undefined : sources[basis];
      const credit = src?.attribution?.required === true ? ` Texto: ${src.attribution.text ?? src.name ?? basis}${src.attribution.link ? ` (${src.attribution.link})` : ""}.` : "";
      const lUrl = licenseUrl(song.license, song.licenseVersion, song.licenseUrl);
      const writer = song.writer?.trim() || null;
      const notice = `${song.title.trim()}${writer ? ` — ${writer}` : ""}. Licença: ${licenseLabel(song.license, song.licenseVersion)}${lUrl ? ` (${lUrl})` : ""}. Fonte: WorshipCommons (${sourceUrl}).${credit}`;

      songs.push({
        id: song.id,
        title: song.title.trim().slice(0, 200),
        writer: writer === null ? null : writer.slice(0, 200),
        language: lang,
        languageName: LANGUAGE[lang] ?? lang,
        key,
        keyEstimated: declared === null,
        bpm: typeof song.bpm === "number" && song.bpm >= 30 && song.bpm <= 300 ? Math.round(song.bpm) : null,
        license: song.license as LibrarySong["license"],
        licenseLabel: licenseLabel(song.license, song.licenseVersion),
        copyrightNotice: notice.slice(0, 500),
        sourceUrl,
        hasChords,
        chordpro,
      });
    }
  }
  return { source: { repository: "https://github.com/ChurchApps/WorshipCommonsContent", commit, generatedAt: new Date().toISOString().slice(0, 10) }, songs };
}

const [, script, rootArg, commitArg] = process.argv;
if (script !== undefined && script.endsWith("build-worshipcommons.ts") && rootArg !== undefined) {
  const lib = buildLibrary(rootArg, commitArg ?? "desconhecido");
  process.stdout.write(`${JSON.stringify(lib)}\n`);
  const byLang = new Map<string, number>();
  for (const s of lib.songs) byLang.set(s.language, (byLang.get(s.language) ?? 0) + 1);
  process.stderr.write(`músicas: ${lib.songs.length} | com cifra: ${lib.songs.filter((s) => s.hasChords).length} | por língua: ${[...byLang].map(([l, n]) => `${l}=${n}`).join(" ")}\n`);
}
