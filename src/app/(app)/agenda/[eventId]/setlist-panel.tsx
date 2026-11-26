"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { addToSetlistAction, moveInSetlistAction, removeFromSetlistAction } from "@/modules/setlists/actions";

export interface SetlistItem { readonly id: string; readonly versionId: string; readonly title: string; readonly targetKey: string | null }
export interface VersionChoice { readonly versionId: string; readonly title: string }

export function SetlistPanel({ sessionId, items, options, canEdit }: { sessionId: string; items: readonly SetlistItem[]; options: readonly VersionChoice[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState("");
  const used = new Set(items.map((i) => i.versionId));
  const available = options.filter((o) => !used.has(o.versionId));

  const run = (job: () => Promise<{ ok: true } | { ok: false; error: { message: string } }>) => {
    setError(null);
    start(async () => { const r = await job(); if (r.ok) router.refresh(); else setError(r.error.message); });
  };

  return (
    <section aria-label="Repertório do culto" className="border-t border-linha py-4">
      <h4 className="mb-2 text-lg">Repertório</h4>
      {items.length === 0 ? <p className="text-sm text-tinta-2">Nenhuma música definida.</p> : (
        <ol className="divide-y divide-linha">
          {items.map((i, idx) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span><span className="tabular text-tinta-2">{idx + 1}.</span>{" "}
                <Link href={`/palco/${i.versionId}${i.targetKey ? `?tom=${encodeURIComponent(i.targetKey)}` : ""}`} className="font-medium underline-offset-2 hover:underline">{i.title}</Link>
                {i.targetKey ? <span className="text-sm text-tinta-2"> · tom {i.targetKey}</span> : null}
              </span>
              {canEdit ? (
                <span className="flex gap-2">
                  <Button type="button" variant="secondary" disabled={pending || idx === 0} aria-label={`Subir ${i.title}`} onClick={() => run(() => moveInSetlistAction({ sessionId, setlistId: i.id, direction: "up" }))}>↑</Button>
                  <Button type="button" variant="secondary" disabled={pending || idx === items.length - 1} aria-label={`Descer ${i.title}`} onClick={() => run(() => moveInSetlistAction({ sessionId, setlistId: i.id, direction: "down" }))}>↓</Button>
                  <Button type="button" variant="secondary" disabled={pending} onClick={() => run(() => removeFromSetlistAction({ sessionId, setlistId: i.id }))}>Remover</Button>
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {canEdit ? (
        <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (!choice) { setError("Escolha uma música."); return; } run(() => addToSetlistAction({ sessionId, versionId: choice })); setChoice(""); }}>
          <label className="flex flex-col gap-1 text-sm">Adicionar música
            <select value={choice} onChange={(e) => setChoice(e.target.value)} className="min-h-11 rounded-controle border border-tinta-2 bg-superficie px-3">
              <option value="">Selecione…</option>
              {available.map((o) => <option key={o.versionId} value={o.versionId}>{o.title}</option>)}
            </select>
          </label>
          <Button type="submit" disabled={pending}>Adicionar</Button>
        </form>
      ) : null}
      {error ? <p role="alert" className="mt-2 text-sm text-vinho">{error}</p> : null}
    </section>
  );
}
