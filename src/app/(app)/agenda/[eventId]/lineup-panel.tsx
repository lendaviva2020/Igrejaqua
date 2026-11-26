"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { addLineupAction, publishLineupAction, removeLineupAction, respondLineupAction } from "@/modules/schedules/actions";
import { LINEUP_STATUS_LABEL } from "@/modules/schedules/schemas";

export interface LineupItem { readonly id: string; readonly function: string; readonly status: string; readonly personName: string; readonly ministryId: string; readonly mine: boolean }
export interface PersonOption { readonly ministryMembershipId: string; readonly name: string; readonly instruments: readonly string[] }

export interface LineupPanelProps {
  readonly sessionId: string;
  readonly ministryId: string;
  readonly ministryName: string;
  readonly items: readonly LineupItem[];
  readonly people: readonly PersonOption[];
  readonly canEdit: boolean;
  readonly canPublish: boolean;
}

export function LineupPanel({ sessionId, ministryId, ministryName, items, people, canEdit, canPublish }: LineupPanelProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [person, setPerson] = useState("");
  const [fn, setFn] = useState("");
  const [override, setOverride] = useState("");
  const [needsOverride, setNeedsOverride] = useState(false);
  const drafts = items.filter((i) => i.status === "draft").length;

  const run = (job: () => Promise<{ ok: true } | { ok: false; error: { message: string; code: string } }>, onFail?: (code: string) => void) => {
    setError(null);
    start(async () => {
      const r = await job();
      if (r.ok) { router.refresh(); return; }
      setError(r.error.message);
      onFail?.(r.error.code);
    });
  };

  return (
    <section aria-label={`Escala — ${ministryName}`} className="mt-2 border-t border-linha py-4">
      <h4 className="mb-2 text-lg">{ministryName}</h4>
      {items.length === 0 ? <p className="text-sm text-texto-2">Ninguém escalado ainda.</p> : (
        <ul className="divide-y divide-linha">
          {items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span><span className="font-medium">{i.personName}</span> <span className="text-sm text-texto-2">· {i.function}</span></span>
              <span className="flex items-center gap-2">
                <span className="text-sm text-texto-2">{LINEUP_STATUS_LABEL[i.status] ?? i.status}</span>
                {i.mine && i.status === "published" ? (
                  <>
                    <Button type="button" disabled={pending} onClick={() => run(() => respondLineupAction({ lineupId: i.id, response: "confirmed" }))}>Confirmar</Button>
                    <Button type="button" variant="secondary" disabled={pending} onClick={() => run(() => respondLineupAction({ lineupId: i.id, response: "declined" }))}>Não posso</Button>
                  </>
                ) : null}
                {canEdit ? <Button type="button" variant="secondary" disabled={pending} onClick={() => run(() => removeLineupAction({ lineupId: i.id }))}>{i.status === "draft" ? "Remover" : "Cancelar"}</Button> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canEdit ? (
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!person || !fn.trim()) { setError("Escolha a pessoa e informe a função."); return; }
            run(
              () => addLineupAction({ sessionId, ministryId, ministryMembershipId: person, function: fn, ...(needsOverride && override.trim() ? { overrideReason: override } : {}) }),
              (code) => { if (code === "RULE_VIOLATION") setNeedsOverride(true); },
            );
          }}
        >
          <label className="flex flex-col gap-1 text-sm">Pessoa
            <select value={person} onChange={(e) => setPerson(e.target.value)} className="min-h-11 rounded-controle border border-borda bg-fundo px-3">
              <option value="">Selecione…</option>
              {people.map((p) => <option key={p.ministryMembershipId} value={p.ministryMembershipId}>{p.name}{p.instruments.length ? ` (${p.instruments.join(", ")})` : ""}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">Função
            <input value={fn} onChange={(e) => setFn(e.target.value)} maxLength={60} className="min-h-11 rounded-controle border border-borda bg-fundo px-3" />
          </label>
          {needsOverride ? (
            <label className="flex flex-col gap-1 text-sm">Justificativa da exceção
              <input value={override} onChange={(e) => setOverride(e.target.value)} maxLength={500} className="min-h-11 rounded-controle border border-borda bg-fundo px-3" />
            </label>
          ) : null}
          <Button type="submit" disabled={pending}>Escalar</Button>
        </form>
      ) : null}
      {canPublish && drafts > 0 ? (
        <Button type="button" className="mt-3" disabled={pending} onClick={() => run(() => publishLineupAction({ sessionId, ministryId }))}>Publicar escala ({drafts})</Button>
      ) : null}
      {error ? <p role="alert" className="mt-2 text-sm text-perigo">{error}</p> : null}
    </section>
  );
}
