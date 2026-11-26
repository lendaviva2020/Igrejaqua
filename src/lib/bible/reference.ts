import { findBookByName, type BibleBook } from "@/lib/bible/books";

export interface BibleReference { readonly book: BibleBook; readonly chapter: number; readonly verseStart: number | null; readonly verseEnd: number | null }

/** Aceita "João 3:16", "Jo 3.16-18", "1 Coríntios 13", "Sl 23". Retorna null se livro/capítulo não existirem. */
export function parseReference(input: string): BibleReference | null {
  const match = /^\s*((?:[123]\s*)?[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]*?)\s*(\d{1,3})(?:\s*[:.]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?)?\s*$/.exec(input.slice(0, 80));
  if (match === null) return null;
  const [, rawBook, rawChapter, rawStart, rawEnd] = match;
  if (rawBook === undefined || rawChapter === undefined) return null;
  const book = findBookByName(rawBook);
  const chapter = Number(rawChapter);
  if (book === undefined || chapter < 1 || chapter > book.chapters) return null;
  const verseStart = rawStart === undefined ? null : Number(rawStart);
  const verseEnd = rawEnd === undefined ? null : Number(rawEnd);
  if (verseStart !== null && verseStart < 1) return null;
  if (verseStart !== null && verseEnd !== null && verseEnd < verseStart) return null;
  return { book, chapter, verseStart, verseEnd };
}
