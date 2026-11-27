"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { Result } from "@/lib/result";
import { acceptRepertoireDraftAction, discardRepertoireDraftAction } from "@/modules/repertoire/ai-actions";

interface Song { readonly song_version_id: string; readonly title: string; readonly artist: string | null; readonly key: string; readonly reason: string | null }
interface NewSong { readonly title: string; readonly artist: string | null; readonly reason: string | null }
interface Issue { readonly code: string; readonly message: string }
export interface RepertoireDraftView {
  readonly runId: string;
  readonly status: "validated" | "validation_failed";
  readonly songs: readonly Song[];
  readonly newSongs: readonly NewSong[];
  readonly violations: readonly Issue[];
  readonly warnings: readonly Issue[];
  readonly theme: { readonly title: string; readonly scripture_ref: string | null } | null;
}

/** Rascunho gerado pelo job diário: a IA só propõe; o setlist nasce quando alguém clica em "Usar este repertório". */
export function AiRepertoirePanel({ eventId, draft }: { eventId: string; draft: RepertoireDraftView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: (input: { runId: string; eventId: string }) => Promise<Result<unknown>>) => {
    setError(null);
    start(async () => {
      const r = await fn({ runId: draft.runId, eventId });
      if (!r.ok) setError(r.error.message);
      router.refresh();
    });
  };
  const usable = draft.status === "validated";
  return (
    <section aria-label="Sugestão de repertório por IA" className="mt-2 rounded-superficie border border-ambar/60 bg-superficie p-4">
      <h4 className="text-lg">Sugestão de repertório (IA)</h4>
      <p className="mt-1 text-sm text-texto-2">
        Montada só com músicas que a igreja já cadastrou{draft.theme ? `, pensando no tema “${draft.theme.title}${draft.theme.scripture_ref ? ` (${draft.theme.scripture_ref})` : ""}”` : ""}. Revise antes de usar.
      </p>

      {draft.songs.length > 0 ? (
        <ol className="mt-3 flex flex-col gap-2">
          {draft.songs.map((s, i) => (
            <li key={s.song_version_id} className="rounded-controle border border-linha bg-fundo px-3 py-2">
              <p className="font-medium"><span className="tabular text-texto-2">{i + 1}.</span> {s.title}{s.artist ? <span className="text-texto-2"> — {s.artist}</span> : null} <span className="text-sm text-ambar-claro">· tom {s.key}</span></p>
              {s.reason ? <p className="text-sm text-texto-2">{s.reason}</p> : null}
            </li>
          ))}
        </ol>
      ) : null}

      {draft.warnings.length > 0 ? (
        <ul className="mt-3 list-disc pl-5 text-sm text-texto-2">{draft.warnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul>
      ) : null}
      {!usable ? (
        <div role="alert" className="mt-3 text-sm text-perigo">
          <p>Esta sugestão não passou na conferência e não pode virar repertório:</p>
          <ul className="list-disc pl-5">{draft.violations.map((v, i) => <li key={i}>{v.message}</li>)}</ul>
        </div>
      ) : null}

      {draft.newSongs.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm font-medium">Músicas novas para o ministério conhecer</p>
          <p className="text-xs text-texto-2">Sugestões de títulos, sem letra nem cifra. Confira se a música existe e cadastre a cifra pela fonte oficial antes de usar.</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {draft.newSongs.map((s) => (
              <li key={s.title}><span className="font-medium">{s.title}</span>{s.artist ? <span className="text-texto-2"> — {s.artist}</span> : null}{s.reason ? <span className="text-texto-2">: {s.reason}</span> : null}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p role="alert" className="mt-3 text-sm text-perigo">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {usable ? <Button type="button" disabled={pending} onClick={() => run(acceptRepertoireDraftAction)}>{pending ? "Salvando…" : "Usar este repertório"}</Button> : null}
        <Button type="button" variant="secondary" disabled={pending} onClick={() => run(discardRepertoireDraftAction)}>Descartar</Button>
      </div>
    </section>
  );
}
