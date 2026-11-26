"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

interface Assignment { readonly ministryMembershipId: string; readonly personName: string; readonly function: string; readonly rationale: string | null; readonly recentCount: number }
interface Violation { readonly code: string; readonly severity: "error" | "warning"; readonly message: string }
interface Suggestion { readonly runId: string; readonly status: "validated" | "validation_failed"; readonly assignments: readonly Assignment[]; readonly violations: readonly Violation[] }
interface Slot { function: string; count: string }

async function postJson(url: string, body: unknown): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json()) as { error?: { message?: string } };
    if (!res.ok) return { ok: false, message: json.error?.message ?? "Não foi possível concluir." };
    return { ok: true, data: json };
  } catch {
    return { ok: false, message: "Sem conexão. Tente novamente." };
  }
}

/** Sugestão consultiva de escala: a IA propõe, o sistema valida e a liderança decide. Aceitar só cria RASCUNHO. */
export function AiSchedulePanel({ sessionId, ministryName }: { sessionId: string; ministryName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [slots, setSlots] = useState<Slot[]>([{ function: "", count: "1" }]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [result, setResult] = useState<Suggestion | null>(null);

  const setSlot = (index: number, patch: Partial<Slot>): void => setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const payload = slots.filter((s) => s.function.trim() !== "").map((s) => ({ function: s.function.trim(), count: Math.min(Math.max(Number.parseInt(s.count, 10) || 1, 1), 10) }));

  const suggest = (): void => {
    setError(null); setDone(null); setResult(null);
    start(async () => {
      const r = await postJson("/api/ai/schedule", { sessionId, slots: payload });
      if (!r.ok) { setError(r.message); return; }
      setResult(r.data as Suggestion);
    });
  };
  const review = (action: "accept" | "discard"): void => {
    if (result === null) return;
    setError(null);
    start(async () => {
      const r = await postJson(`/api/ai/runs/${result.runId}`, { action });
      if (!r.ok) { setError(r.message); return; }
      setResult(null);
      setDone(action === "accept" ? "Rascunho criado. Revise abaixo e publique quando estiver certo." : "Sugestão descartada.");
      router.refresh();
    });
  };

  return (
    <section aria-label={`Sugestão de escala por IA — ${ministryName}`} className="mt-2 rounded-superficie border border-linha bg-superficie p-4">
      <h4 className="text-lg">Sugestão por IA</h4>
      <p className="mt-1 text-sm text-texto-2">Diga quantas pessoas faltam em cada função. A IA sugere; o sistema confere disponibilidade, rotação e conflitos, e você decide.</p>
      <div className="mt-3 flex flex-col gap-2">
        {slots.map((slot, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">Função
              <input value={slot.function} onChange={(e) => setSlot(index, { function: e.target.value })} maxLength={40} placeholder="Ex.: bateria" className="min-h-11 rounded-controle border border-borda bg-fundo px-3 text-base" />
            </label>
            <label className="flex flex-col gap-1 text-sm">Vagas
              <input value={slot.count} onChange={(e) => setSlot(index, { count: e.target.value })} inputMode="numeric" pattern="[0-9]*" className="min-h-11 w-20 rounded-controle border border-borda bg-fundo px-3 text-base" />
            </label>
            {slots.length > 1 ? <Button variant="quiet" onClick={() => setSlots((prev) => prev.filter((_, i) => i !== index))}>Remover</Button> : null}
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {slots.length < 6 ? <Button variant="secondary" onClick={() => setSlots((prev) => [...prev, { function: "", count: "1" }])}>Outra função</Button> : null}
          <Button disabled={pending || payload.length === 0} onClick={suggest}>{pending && result === null ? "Pedindo sugestão…" : "Pedir sugestão"}</Button>
        </div>
      </div>
      <p role={error ? "alert" : "status"} aria-live="polite" className={`mt-3 min-h-5 text-sm ${error ? "text-perigo" : "text-sucesso"}`}>{error ?? done ?? ""}</p>
      {result !== null ? (
        <div className="mt-2">
          <p className="text-sm font-semibold text-ambar-claro">Sugestão da IA: revise antes de aceitar</p>
          {result.assignments.length === 0 ? <p className="mt-2 text-sm text-texto-2">Nenhuma indicação passou na validação.</p> : (
            <ul className="mt-2 divide-y divide-linha">
              {result.assignments.map((a) => (
                <li key={`${a.ministryMembershipId}-${a.function}`} className="py-2">
                  <p><span className="font-medium">{a.personName}</span> <span className="text-sm text-texto-2">· {a.function}</span></p>
                  <p className="text-sm text-texto-2">Escalado {a.recentCount}x nesta função nas últimas semanas{a.rationale ? ` · ${a.rationale}` : ""}</p>
                </li>
              ))}
            </ul>
          )}
          {result.violations.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1 text-sm" aria-label="Avisos da validação">
              {result.violations.map((v, i) => <li key={i} className={v.severity === "error" ? "text-perigo" : "text-texto-2"}>{v.severity === "error" ? "Barrado: " : "Atenção: "}{v.message}</li>)}
            </ul>
          ) : null}
          {result.status === "validation_failed" ? <p className="mt-3 text-sm text-texto-2">Esta sugestão tem itens barrados e não pode virar rascunho. Descarte e peça outra, ou monte manualmente.</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {result.status === "validated" ? <Button disabled={pending} onClick={() => review("accept")}>Aceitar como rascunho</Button> : null}
            <Button variant="secondary" disabled={pending} onClick={() => review("discard")}>Descartar</Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
