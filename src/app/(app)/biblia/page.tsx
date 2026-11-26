import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { BIBLE_BOOKS } from "@/lib/bible/books";
import { BIBLE_TRANSLATIONS, BIBLE_TRANSLATION_IDS, parseTranslation } from "@/lib/bible/client";
import { parseReference } from "@/lib/bible/reference";

export const metadata: Metadata = { title: "Bíblia" };

export default async function BibleIndexPage({ searchParams }: { searchParams: Promise<{ q?: string; t?: string }> }) {
  const { q, t } = await searchParams;
  const translation = parseTranslation(t);
  let notFound = false;
  if (q !== undefined && q.trim() !== "") {
    const ref = parseReference(q);
    if (ref !== null) {
      const verse = ref.verseStart === null ? "" : `&v=${ref.verseStart}${ref.verseEnd !== null ? `-${ref.verseEnd}` : ""}`;
      redirect(`/biblia/${ref.book.slug}/${ref.chapter}?t=${translation}${verse}`);
    }
    notFound = true;
  }
  const groups = [{ title: "Antigo Testamento", books: BIBLE_BOOKS.filter((b) => b.testament === "AT") }, { title: "Novo Testamento", books: BIBLE_BOOKS.filter((b) => b.testament === "NT") }];
  return (
    <>
      <PageHeader title="Bíblia" description="Leia por livro e capítulo ou vá direto a uma referência." />
      <form method="get" className="mb-8 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium" htmlFor="q">
          Ir para (ex.: João 3:16, Sl 23, 1 Coríntios 13)
          <input id="q" name="q" defaultValue={q ?? ""} autoComplete="off" className="min-h-12 w-full min-w-0 rounded-xl border border-linha bg-fundo px-4 text-base" aria-describedby={notFound ? "q-erro" : undefined} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium" htmlFor="t">
          Tradução
          <select id="t" name="t" defaultValue={translation} className="min-h-12 rounded-xl border border-linha bg-fundo px-3 text-base">
            {BIBLE_TRANSLATION_IDS.map((id) => <option key={id} value={id}>{BIBLE_TRANSLATIONS[id].label}</option>)}
          </select>
        </label>
        <button type="submit" className="min-h-12 rounded-full bg-ambar px-6 font-semibold text-fundo">Abrir</button>
      </form>
      {notFound ? <p id="q-erro" role="alert" className="-mt-4 mb-6 text-sm text-perigo">Não encontramos essa referência. Confira o livro e o capítulo.</p> : null}
      <div className="flex flex-col gap-10">
        {groups.map((group) => (
          <section key={group.title} aria-label={group.title}>
            <h2 className="mb-3 text-2xl">{group.title}</h2>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {group.books.map((book) => (
                <li key={book.slug}>
                  <Link href={`/biblia/${book.slug}/1?t=${translation}`} className="flex min-h-12 items-center rounded-xl border border-linha bg-superficie px-4 font-medium hover:border-ambar">{book.name}</Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
