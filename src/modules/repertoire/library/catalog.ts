import "server-only";
import { z } from "zod";
import raw from "./worshipcommons.json";

/**
 * Biblioteca aberta do repertório: músicas do WorshipCommonsContent com licença que permite o uso
 * pela igreja (gerada por tools/library/build-worshipcommons.ts). Só no servidor: o arquivo tem
 * ~2 MB e nunca vai para o celular; a busca devolve páginas pequenas.
 */

const SongSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{6,20}$/),
  title: z.string().min(1).max(200),
  writer: z.string().max(200).nullable(),
  language: z.string().min(2).max(3),
  languageName: z.string(),
  key: z.string().regex(/^[A-G][#b]?m?$/),
  keyEstimated: z.boolean(),
  bpm: z.number().int().min(30).max(300).nullable(),
  license: z.enum(["PD", "WC", "CC-BY", "CC-BY-SA"]),
  licenseLabel: z.string(),
  copyrightNotice: z.string().max(500),
  sourceUrl: z.string().startsWith("https://worshipcommons.org/songs/"),
  hasChords: z.boolean(),
  chordpro: z.string().max(65536),
});
const FileSchema = z.object({ source: z.object({ repository: z.string(), commit: z.string(), generatedAt: z.string() }), songs: z.array(SongSchema) });

export type LibrarySong = z.infer<typeof SongSchema>;
export type LibrarySongSummary = Omit<LibrarySong, "chordpro"> & { readonly preview: string };

interface Indexed { readonly song: LibrarySong; readonly haystack: string }
let cache: { readonly songs: readonly Indexed[]; readonly byId: ReadonlyMap<string, LibrarySong>; readonly source: z.infer<typeof FileSchema>["source"] } | null = null;

/** Sem acento e em minúsculas, para a busca achar "nao" em "Não". */
export function foldText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function load(): NonNullable<typeof cache> {
  if (cache !== null) return cache;
  const file = FileSchema.parse(raw);
  const songs = file.songs.map((song) => ({ song, haystack: foldText(`${song.title} ${song.writer ?? ""}`) }));
  cache = { songs, byId: new Map(file.songs.map((s) => [s.id, s])), source: file.source };
  return cache;
}

/** Primeiras linhas cantadas, sem acordes nem diretivas (prévia curta na lista). */
function previewOf(chordpro: string): string {
  return chordpro
    .split("\n")
    .filter((l) => l.trim() !== "" && !l.trim().startsWith("{"))
    .slice(0, 2)
    .map((l) => l.replace(/\[[^\]]*\]/g, "").trim())
    .join(" / ")
    .slice(0, 140);
}

export interface LibraryQuery {
  readonly q: string;
  readonly language: string; // "todas" ou código
  readonly chordsOnly: boolean;
  readonly page: number;
}

export const PAGE_SIZE = 24;

export function searchLibrary(query: LibraryQuery): { readonly items: readonly LibrarySongSummary[]; readonly total: number; readonly hasMore: boolean } {
  const { songs } = load();
  const terms = foldText(query.q.trim()).split(/\s+/).filter((t) => t !== "");
  const filtered = songs.filter(({ song, haystack }) =>
    (query.language === "todas" || song.language === query.language) &&
    (!query.chordsOnly || song.hasChords) &&
    terms.every((t) => haystack.includes(t)),
  );
  // Português primeiro; depois ordem alfabética.
  filtered.sort((a, b) => (a.song.language === "pt" ? 0 : 1) - (b.song.language === "pt" ? 0 : 1) || a.song.title.localeCompare(b.song.title, "pt-BR"));
  const start = (query.page - 1) * PAGE_SIZE;
  const items = filtered.slice(start, start + PAGE_SIZE).map(({ song }) => {
    const { chordpro, ...rest } = song;
    return { ...rest, preview: previewOf(chordpro) };
  });
  return { items, total: filtered.length, hasMore: start + PAGE_SIZE < filtered.length };
}

export function getLibrarySong(id: string): LibrarySong | null {
  return load().byId.get(id) ?? null;
}

/** Línguas disponíveis com a contagem (para o filtro). */
export function libraryLanguages(): readonly { readonly code: string; readonly name: string; readonly count: number }[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const { song } of load().songs) {
    const c = counts.get(song.language) ?? { name: song.languageName, count: 0 };
    c.count += 1;
    counts.set(song.language, c);
  }
  return [...counts].map(([code, v]) => ({ code, name: v.name, count: v.count })).sort((a, b) => (a.code === "pt" ? -1 : b.code === "pt" ? 1 : b.count - a.count));
}

export function librarySource(): z.infer<typeof FileSchema>["source"] {
  return load().source;
}
