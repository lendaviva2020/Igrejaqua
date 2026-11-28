import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { foldText, libraryLanguages, librarySource, searchLibrary } from "@/modules/repertoire/library/catalog";
import { listSongs } from "@/modules/repertoire/queries";
import { AddLibrarySong } from "./add-library-song";

export const metadata: Metadata = { title: "Biblioteca aberta" };

type SearchParams = Promise<{ q?: string; lingua?: string; cifra?: string; pagina?: string }>;

const chip = "inline-flex items-center rounded-full border border-linha bg-fundo px-2.5 py-0.5 text-xs text-texto-2";

/**
 * Biblioteca aberta: hinos e cânticos com licença livre (WorshipCommons). A busca roda no servidor
 * pela URL (funciona sem JavaScript e o link pode ser compartilhado com a equipe).
 */
export default async function LibraryPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await resolveChurchContext();
  const params = await searchParams;
  const q = (params.q ?? "").slice(0, 80);
  const languages = libraryLanguages();
  const language = params.lingua === "todas" || languages.some((l) => l.code === params.lingua) ? (params.lingua as string) : "todas";
  const chordsOnly = params.cifra !== "todas";
  const page = Math.min(Math.max(Number.parseInt(params.pagina ?? "1", 10) || 1, 1), 100);
  const [result, existing] = await Promise.all([Promise.resolve(searchLibrary({ q, language, chordsOnly, page })), listSongs(ctx.churchId)]);
  const owned = new Set(existing.map((s) => foldText(s.title)));
  const canManage = can(ctx, "repertoire.manage");
  const source = librarySource();
  const nextHref = `?${new URLSearchParams({ ...(q ? { q } : {}), lingua: language, cifra: chordsOnly ? "sim" : "todas", pagina: String(page + 1) }).toString()}`;

  return (
    <>
      <Link href="/repertorio" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-texto-2 hover:text-texto"><ArrowLeft aria-hidden="true" size={16} />Repertório</Link>
      <PageHeader title="Biblioteca aberta" description="Hinos e cânticos com licença livre para a igreja usar. Adicione ao repertório: letra e tom vêm prontos, e a cifra também, quando a música tiver." />

      <form method="get" role="search" className="mb-6 grid gap-3 rounded-superficie border border-linha bg-superficie p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Buscar
          <input name="q" defaultValue={q} placeholder="Título ou autor (ex.: Castelo Forte)" className="min-h-11 rounded-controle border border-borda bg-fundo px-3 text-base text-texto placeholder:text-texto-2/70" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Língua
          <select name="lingua" defaultValue={language} className="min-h-11 rounded-controle border border-borda bg-fundo px-3 text-texto">
            <option value="todas">Todas</option>
            {languages.map((l) => <option key={l.code} value={l.code}>{l.name} ({l.count})</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Mostrar
          <select name="cifra" defaultValue={chordsOnly ? "sim" : "todas"} className="min-h-11 rounded-controle border border-borda bg-fundo px-3 text-texto">
            <option value="sim">Só com cifra</option>
            <option value="todas">Com cifra e só letra</option>
          </select>
        </label>
        <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ambar px-5 text-sm font-semibold text-sobre-ambar hover:bg-ambar-claro"><Search aria-hidden="true" size={16} />Buscar</button>
      </form>

      <p aria-live="polite" className="mb-3 text-sm text-texto-2">{result.total === 1 ? "1 música encontrada" : `${result.total} músicas encontradas`}</p>

      {result.items.length === 0 ? (
        <EmptyState title="Nenhuma música com esses filtros">
          {chordsOnly ? "Tente “Com cifra e só letra” ou outra língua. Em português, a biblioteca tem sobretudo hinos clássicos de domínio público." : "Tente outro termo ou outra língua."}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {result.items.map((s) => {
            const already = owned.has(foldText(s.title));
            return (
              <li key={s.id} className="rounded-superficie border border-linha bg-superficie p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-sans text-lg font-semibold leading-snug">{s.title}</h2>
                    {s.writer ? <p className="text-sm text-texto-2">{s.writer}</p> : null}
                  </div>
                  <span className="tabular rounded-controle bg-superficie-2 px-2.5 py-1 font-mono text-sm text-ambar-claro" title={s.keyEstimated ? "Tom estimado pelo primeiro acorde" : "Tom original"}>{s.key}{s.keyEstimated ? "*" : ""}</span>
                </div>
                {s.preview ? <p className="mt-2 line-clamp-2 text-sm text-texto-2">{s.preview}</p> : null}
                <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Detalhes">
                  <li className={chip}>{s.languageName}</li>
                  <li className={chip}>{s.hasChords ? "Com cifra" : "Só letra"}</li>
                  <li className={chip}>{s.licenseLabel}</li>
                  {s.bpm !== null ? <li className={chip}>{s.bpm} BPM</li> : null}
                </ul>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {already ? <span className="text-sm text-sucesso">Já está no repertório</span> : canManage ? <AddLibrarySong id={s.id} title={s.title} /> : null}
                  <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-texto-2 underline hover:text-texto">Ver na WorshipCommons<span className="sr-only"> (abre em nova aba)</span></a>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {result.hasMore ? <div className="mt-6"><Link href={nextHref} className="inline-flex min-h-11 items-center rounded-full border border-borda px-5 text-sm font-semibold hover:border-ambar">Ver mais músicas</Link></div> : null}

      <p className="mt-10 text-xs text-texto-2">
        Músicas da <a className="underline" href="https://worshipcommons.org" target="_blank" rel="noopener noreferrer">WorshipCommons</a> (catálogo de {source.generatedAt}). Cada música leva o crédito e a licença para a página dela no repertório. * Tom estimado pelo primeiro acorde.
      </p>
    </>
  );
}
