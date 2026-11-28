"use client";

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, ClipboardPaste, Link2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { importSongFromLinkAction, type SongImportResult } from "@/modules/repertoire/import-actions";
import { extractSongFromPaste, type ImportWarning } from "@/modules/repertoire/import/extract";

const WARNING_TEXT: Readonly<Record<ImportWarning, string>> = {
  "key-estimated": "O tom não estava indicado: estimamos pelo primeiro acorde. Confira.",
  "key-missing": "Não encontramos o tom. Escolha o tom original no formulário.",
  "no-chords": "A página não trouxe a cifra (alguns sites só mostram a cifra no navegador). Copie a cifra da página e use Colar cifra.",
  "tabs-removed": "As tablaturas ficaram de fora (o repertório guarda acordes e letra).",
  capo: "Há indicação de capotraste; ela foi incluída no início da cifra.",
  "artist-missing": "Não encontramos o artista.",
  "media-no-chords": "Vídeo e áudio não têm cifra: trouxemos música e artista, e o link fica salvo como referência para ouvir. Agora procure a cifra, copie e cole abaixo.",
};

type Mode = "link" | "paste";

/**
 * Importação para o formulário "Nova música", por dois caminhos:
 * - Link: o servidor abre a página (sites que permitem acesso automatizado);
 * - Colar cifra: a conversão roda aqui no navegador e funciona com qualquer site.
 * Nada é salvo aqui; a pessoa revisa e salva.
 */
export function SongImport({ onImported }: { onImported: (song: SongImportResult) => void }) {
  const id = useId();
  const [mode, setMode] = useState<Mode>("link");
  const [url, setUrl] = useState("");
  const [pasted, setPasted] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SongImportResult | null>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);

  const choose = (next: Mode): void => {
    setMode(next);
    setError(null);
    if (next === "paste") requestAnimationFrame(() => pasteRef.current?.focus());
  };

  const finish = (song: SongImportResult): void => {
    setResult(song);
    onImported(song);
  };

  const submitLink = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await importSongFromLinkAction({ url });
      if (!r.ok) {
        setResult(null);
        setError(r.error.message);
        if (r.error.fields?.["fallback"]?.includes("paste") === true) choose("paste");
        return;
      }
      finish(r.data);
      // Vídeo/áudio não tem cifra: o próximo passo natural é colar a cifra.
      if (r.data.warnings.includes("media-no-chords")) choose("paste");
    });
  };

  const submitPaste = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setError(null);
    if (pasted.trim() === "") { setError("Cole a cifra no campo antes de converter."); return; }
    // Mantém o vídeo de uma importação anterior (YouTube) como referência.
    finish({ ...extractSongFromPaste(pasted), sourceHost: null, referenceUrl: result?.referenceUrl ?? null });
  };

  const tab = (value: Mode, label: string, Icon: typeof Link2) => (
    <button
      type="button"
      onClick={() => choose(value)}
      aria-pressed={mode === value}
      className={cn("inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors sm:flex-none", mode === value ? "bg-ambar text-sobre-ambar" : "text-texto-2 hover:text-texto")}
    >
      <Icon aria-hidden="true" size={16} />{label}
    </button>
  );

  return (
    <section aria-labelledby={`${id}-titulo`} className="mb-8 max-w-2xl rounded-superficie border border-linha bg-superficie p-4 sm:p-5">
      <h3 id={`${id}-titulo`} className="font-sans text-base font-semibold">Preencher automaticamente</h3>
      <p className="mt-0.5 text-sm text-texto-2">Traga título, artista, tom e cifra de outra página. Você revisa antes de salvar.</p>

      <div role="group" aria-label="Como importar" className="mt-4 flex gap-1 rounded-full border border-linha bg-fundo p-1 sm:inline-flex">
        {tab("link", "Link", Link2)}
        {tab("paste", "Colar cifra", ClipboardPaste)}
      </div>

      {mode === "link" ? (
        <form onSubmit={submitLink} className="mt-3 flex flex-col gap-2 sm:flex-row" noValidate>
          <label htmlFor={`${id}-url`} className="sr-only">Link da página da música</label>
          <input
            id={`${id}-url`}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="Link da cifra, do YouTube ou do Spotify"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-invalid={error !== null ? true : undefined}
            aria-describedby={error !== null ? `${id}-erro` : undefined}
            className="min-h-11 min-w-0 flex-1 rounded-controle border border-borda bg-fundo px-3 text-base text-texto placeholder:text-texto-2/70"
          />
          <Button type="submit" disabled={pending || url.trim() === ""} aria-busy={pending}>{pending ? "Buscando…" : "Buscar música"}</Button>
        </form>
      ) : (
        <form onSubmit={submitPaste} className="mt-3 flex flex-col gap-2" noValidate>
          <label htmlFor={`${id}-cifra`} className="sr-only">Cifra copiada</label>
          <textarea
            ref={pasteRef}
            id={`${id}-cifra`}
            rows={7}
            spellCheck={false}
            placeholder={"Cole aqui a cifra copiada do site, com os acordes em cima da letra.\nSe vier o título, o artista e o tom no começo, eles também são aproveitados."}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            aria-describedby={error !== null ? `${id}-erro` : undefined}
            className="rounded-controle border border-borda bg-fundo p-3 font-mono text-sm text-texto placeholder:font-sans placeholder:text-texto-2/70"
          />
          <Button type="submit" variant="secondary" className="self-start" disabled={pasted.trim() === ""}>Converter cifra</Button>
        </form>
      )}

      <div aria-live="polite">
        {error !== null ? <p id={`${id}-erro`} role="alert" className="mt-3 text-sm text-perigo">{error}</p> : null}
        {result !== null ? (
          <div className="mt-4 border-t border-linha pt-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-sucesso">
              <CheckCircle2 aria-hidden="true" size={18} />{result.sourceHost !== null ? `Encontrado em ${result.sourceHost}` : "Cifra convertida"}
            </p>
            <dl className="mt-3 flex flex-wrap gap-2 text-sm">
              {([["Música", result.title], ["Artista", result.artist], ["Tom", result.key], ["BPM", result.bpm === null ? null : String(result.bpm)]] as const).map(([label, value]) => value === null ? null : (
                <div key={label} className="flex max-w-full items-baseline gap-1.5 rounded-full border border-linha bg-fundo px-3 py-1">
                  <dt className="text-texto-2">{label}</dt>
                  <dd className="min-w-0 truncate font-semibold text-texto">{value}</dd>
                </div>
              ))}
            </dl>
            {result.warnings.includes("media-no-chords") && result.title !== null ? (
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(`cifra ${result.title}${result.artist !== null ? ` ${result.artist}` : ""}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-borda px-4 text-sm font-semibold text-texto hover:border-ambar"
              >
                <Search aria-hidden="true" size={16} />Procurar a cifra<span className="sr-only"> (abre em nova aba)</span>
              </a>
            ) : null}
            {result.warnings.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-1.5">
                {result.warnings.map((w) => (
                  <li key={w} className="flex gap-2 text-sm text-ambar-claro"><AlertTriangle aria-hidden="true" size={16} className="mt-0.5 shrink-0" />{WARNING_TEXT[w]}</li>
                ))}
              </ul>
            ) : null}
            <p className="mt-3 text-sm text-texto-2">Revise os campos abaixo e toque em Salvar música. Letras e cifras continuam sujeitas aos direitos dos autores.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
