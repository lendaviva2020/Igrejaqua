import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { findBookBySlug } from "@/lib/bible/books";
import { BIBLE_TRANSLATIONS, BIBLE_TRANSLATION_IDS, BibleUnavailableError, fetchChapter, parseTranslation, type BibleChapter } from "@/lib/bible/client";

interface Params { livro: string; capitulo: string }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { livro, capitulo } = await params;
  const book = findBookBySlug(livro);
  return { title: book ? `${book.name} ${capitulo}` : "Bíblia" };
}

/** "16" ou "16-18" → intervalo de versículos em destaque. */
function parseHighlight(value: string | undefined): readonly [number, number] | null {
  const match = /^(\d{1,3})(?:-(\d{1,3}))?$/.exec(value ?? "");
  if (match === null || match[1] === undefined) return null;
  const start = Number(match[1]);
  const end = match[2] === undefined ? start : Number(match[2]);
  return end >= start ? [start, end] : null;
}

export default async function BibleChapterPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ t?: string; v?: string }> }) {
  const [{ livro, capitulo }, { t, v }] = await Promise.all([params, searchParams]);
  const book = findBookBySlug(livro);
  const chapterNumber = /^\d{1,3}$/.test(capitulo) ? Number(capitulo) : 0;
  if (book === undefined || chapterNumber < 1 || chapterNumber > book.chapters) notFound();
  const translation = parseTranslation(t);
  const highlight = parseHighlight(v);

  let data: BibleChapter | null = null;
  try {
    data = await fetchChapter(translation, book, chapterNumber);
  } catch (cause) {
    if (!(cause instanceof BibleUnavailableError)) throw cause;
    console.error("bible_fetch_failed", cause.message);
  }

  const href = (chapter: number, id = translation) => `/biblia/${book.slug}/${chapter}?t=${id}`;
  const info = BIBLE_TRANSLATIONS[translation];
  return (
    <>
      <PageHeader title={`${book.name} ${chapterNumber}`} description={info.label} actions={<Link href="/biblia" className="inline-flex min-h-11 items-center rounded-full border border-linha px-5 text-sm font-semibold hover:bg-superficie-2">Livros</Link>} />
      <nav aria-label="Tradução" className="mb-6 flex flex-wrap gap-2">
        {BIBLE_TRANSLATION_IDS.map((id) => (
          <Link key={id} href={href(chapterNumber, id)} aria-current={id === translation ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${id === translation ? "border-ambar bg-ambar text-fundo" : "border-linha hover:bg-superficie-2"}`}>{BIBLE_TRANSLATIONS[id].label}</Link>
        ))}
      </nav>
      {data === null ? (
        <div role="alert" className="rounded-superficie border border-linha bg-superficie p-6">
          <p className="font-semibold">Não foi possível carregar este capítulo agora.</p>
          <p className="mt-1 text-sm text-texto-2">O serviço de texto bíblico não respondeu. Tente de novo em instantes ou escolha outra tradução.</p>
          <Link href={href(chapterNumber)} className="mt-3 inline-flex min-h-11 items-center rounded-full bg-ambar px-5 font-semibold text-fundo">Tentar de novo</Link>
        </div>
      ) : (
        <article className="max-w-prose text-lg leading-relaxed">
          {data.verses.map((verse) => {
            const marked = highlight !== null && verse.number >= highlight[0] && verse.number <= highlight[1];
            return (
              <p key={verse.number} id={`v${verse.number}`} className={`mb-3 scroll-mt-24 rounded-lg px-2 ${marked ? "bg-ambar/15 ring-1 ring-ambar/50" : ""}`}>
                <sup className="mr-1 font-mono text-xs text-ambar-claro">{verse.number}</sup>{verse.text}
              </p>
            );
          })}
        </article>
      )}
      <div className="mt-8 flex items-center justify-between gap-3">
        {chapterNumber > 1 ? <Link href={href(chapterNumber - 1)} className="inline-flex min-h-12 items-center rounded-full border border-linha px-5 font-semibold hover:bg-superficie-2">Capítulo {chapterNumber - 1}</Link> : <span />}
        {chapterNumber < book.chapters ? <Link href={href(chapterNumber + 1)} className="inline-flex min-h-12 items-center rounded-full bg-ambar px-5 font-semibold text-fundo">Capítulo {chapterNumber + 1}</Link> : <span />}
      </div>
      <p className="mt-10 text-xs text-texto-2">Texto: {info.label} — {info.license}. Fornecido pela API getBible.</p>
    </>
  );
}
