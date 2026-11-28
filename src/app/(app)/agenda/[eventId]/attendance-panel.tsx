"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { leaderCheckInAction, removeAttendanceAction, selfCheckInAction } from "@/modules/attendance/actions";

interface Entry { id: string; membershipId: string; name: string; method: "self" | "leader" | "qr"; checkedInAt: string }
const METHOD_LABEL = { self: "pelo próprio celular", leader: "registrado pela liderança", qr: "por QR" } as const;

/**
 * `timeZone` é o fuso da igreja: servidor (UTC) e navegador formatariam horários diferentes sem ele,
 * quebrando a hidratação (React #418) e mostrando a hora errada a quem estiver em outro fuso.
 */
export function AttendancePanel({ sessionId, open, checkedIn, canRecordOthers, entries, people, timeZone }: {
  sessionId: string; open: boolean; checkedIn: boolean; canRecordOthers: boolean; entries: readonly Entry[]; people: readonly { membershipId: string; name: string }[]; timeZone: string;
}) {
  const timeFmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone });
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const present = new Set(entries.map((e) => e.membershipId));
  const absent = people.filter((p) => !present.has(p.membershipId));
  const [pick, setPick] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>) => {
    setError(null);
    start(async () => { const r = await fn(); if (r.ok) router.refresh(); else setError(r.error?.message ?? "Falha na operação."); });
  };
  return (
    <section aria-label="Presença" className="mt-4 rounded-superficie border border-linha bg-superficie p-4">
      <h4 className="mb-2 font-display text-lg font-bold">Presença</h4>
      {checkedIn ? <p role="status" className="text-sucesso">Sua presença está registrada.</p> : open ? (
        <Button type="button" disabled={pending} onClick={() => run(() => selfCheckInAction({ sessionId }))}>Estou aqui</Button>
      ) : <p className="text-sm text-texto-2">O check-in abre 1 hora antes do início e fecha no fim da sessão.</p>}
      {canRecordOthers ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="tabular text-sm text-texto-2">{entries.length} {entries.length === 1 ? "pessoa presente" : "pessoas presentes"}</p>
          {entries.length > 0 ? (
            <ul className="divide-y divide-linha">
              {entries.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{e.name} <span className="text-sm text-texto-2">· {timeFmt.format(new Date(e.checkedInAt))} · {METHOD_LABEL[e.method]}</span></span>
                  <Button type="button" variant="quiet" disabled={pending} aria-label={`Remover presença de ${e.name}`} onClick={() => run(() => removeAttendanceAction({ attendanceId: e.id }))}>Remover</Button>
                </li>
              ))}
            </ul>
          ) : null}
          {absent.length > 0 ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1.5 text-sm font-medium">Registrar presença de
                <select value={pick} onChange={(e) => setPick(e.target.value)} className="min-h-11 rounded-controle border border-borda bg-superficie px-3 text-texto">
                  <option value="">Selecione…</option>
                  {absent.map((p) => <option key={p.membershipId} value={p.membershipId}>{p.name}</option>)}
                </select>
              </label>
              <Button type="button" variant="secondary" disabled={pending || pick === ""} onClick={() => run(async () => { const r = await leaderCheckInAction({ sessionId, membershipId: pick }); if (r.ok) setPick(""); return r; })}>Registrar</Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-2 text-sm text-perigo">{error}</p> : null}
    </section>
  );
}
