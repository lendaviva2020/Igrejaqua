import { z } from "zod";
import type { BibleBook } from "@/lib/bible/books";

/**
 * Fonte: getBible API v2 (https://api.getbible.net/v2) — gratuita, sem chave, JSON estático por capítulo.
 * Só as traduções abaixo são aceitas (allowlist): a URL nunca é montada a partir de texto livre.
 */
export const BIBLE_API_BASE = "https://api.getbible.net/v2";

export const BIBLE_TRANSLATIONS = {
  livre: { id: "livre", label: "Bíblia Livre", license: "Creative Commons Atribuição 3.0 Brasil (CC BY 3.0 BR)" },
  almeida: { id: "almeida", label: "Almeida Atualizada", license: "Módulo CrossWire distribuído pela getBible sob GPL" },
} as const;
export type BibleTranslationId = keyof typeof BIBLE_TRANSLATIONS;
export const DEFAULT_TRANSLATION: BibleTranslationId = "livre";
export const BIBLE_TRANSLATION_IDS = Object.keys(BIBLE_TRANSLATIONS) as BibleTranslationId[];

export function parseTranslation(value: string | undefined): BibleTranslationId {
  return BIBLE_TRANSLATION_IDS.find((id) => id === value) ?? DEFAULT_TRANSLATION;
}

const ChapterResponse = z.object({
  book_nr: z.number().int(),
  chapter: z.number().int(),
  verses: z.array(z.object({ chapter: z.number().int(), verse: z.number().int().min(1), text: z.string() })).min(1).max(200),
});

export interface BibleVerse { readonly number: number; readonly text: string }
export interface BibleChapter { readonly translation: BibleTranslationId; readonly book: BibleBook; readonly chapter: number; readonly verses: readonly BibleVerse[] }

export class BibleUnavailableError extends Error {
  constructor(message: string) { super(message); this.name = "BibleUnavailableError"; }
}

const THIRTY_DAYS = 60 * 60 * 24 * 30;

/** Texto bíblico é imutável: cache longo no servidor; timeout curto para não travar a página. */
export async function fetchChapter(translation: BibleTranslationId, book: BibleBook, chapter: number, fetchImpl: typeof fetch = fetch): Promise<BibleChapter> {
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) throw new BibleUnavailableError("Capítulo inexistente.");
  let response: Response;
  try {
    response = await fetchImpl(`${BIBLE_API_BASE}/${translation}/${book.nr}/${chapter}.json`, { signal: AbortSignal.timeout(8000), headers: { accept: "application/json" }, next: { revalidate: THIRTY_DAYS } });
  } catch {
    throw new BibleUnavailableError("Não foi possível alcançar o serviço da Bíblia.");
  }
  if (!response.ok) throw new BibleUnavailableError(`Serviço da Bíblia respondeu ${response.status}.`);
  let json: unknown;
  try { json = await response.json(); } catch { throw new BibleUnavailableError("Resposta inválida do serviço da Bíblia."); }
  const parsed = ChapterResponse.safeParse(json);
  if (!parsed.success || parsed.data.book_nr !== book.nr || parsed.data.chapter !== chapter) throw new BibleUnavailableError("Resposta inesperada do serviço da Bíblia.");
  return { translation, book, chapter, verses: parsed.data.verses.map((v) => ({ number: v.verse, text: v.text.replace(/\s+/g, " ").trim() })) };
}
