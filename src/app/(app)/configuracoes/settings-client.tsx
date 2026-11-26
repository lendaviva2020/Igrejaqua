"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { createDsrAction, resolveDsrAction, updateChurchAction, updateProfileAction } from "@/modules/settings/actions";
import { DSR_KINDS, DSR_KIND_LABEL, UpdateChurchSchema, UpdateProfileSchema } from "@/modules/settings/schemas";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, after?: () => void) => {
    setError(null); setSaved(false);
    start(async () => { const r = await fn(); if (r.ok) { setSaved(true); after?.(); router.refresh(); } else setError(r.error?.message ?? "Falha na operação."); });
  };
  return { pending, error, setError, saved, run };
}
const Feedback = ({ error, saved }: { error: string | null; saved: boolean }) => (
  <p role={error ? "alert" : "status"} aria-live="polite" className={`min-h-5 text-sm ${error ? "text-perigo" : "text-sucesso"}`}>{error ?? (saved ? "Salvo." : "")}</p>
);

export function ProfileForm({ initial }: { initial: { fullName: string; displayName: string; phone: string } }) {
  const a = useAction();
  const [v, setV] = useState(initial);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = UpdateProfileSchema.safeParse({ fullName: v.fullName, ...(v.displayName.trim() ? { displayName: v.displayName } : {}), ...(v.phone.trim() ? { phone: v.phone } : {}) });
    if (!parsed.success) { a.setError(parsed.error.issues[0]?.message ?? "Dados inválidos."); return; }
    a.run(() => updateProfileAction(parsed.data));
  };
  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-4" noValidate>
      <FormField label="Nome completo" autoComplete="name" value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} />
      <FormField label="Como prefere ser chamado (opcional)" value={v.displayName} onChange={(e) => setV({ ...v, displayName: e.target.value })} maxLength={80} />
      <FormField label="Telefone (opcional, visível só para a administração)" type="tel" autoComplete="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} maxLength={32} />
      <Feedback error={a.error} saved={a.saved} />
      <Button type="submit" disabled={a.pending}>{a.pending ? "Salvando…" : "Salvar perfil"}</Button>
    </form>
  );
}

export function ChurchForm({ initial }: { initial: { name: string; legalName: string; documentNumber: string; timezone: string } }) {
  const a = useAction();
  const [v, setV] = useState(initial);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = UpdateChurchSchema.safeParse({ name: v.name, timezone: v.timezone, ...(v.legalName.trim() ? { legalName: v.legalName } : {}), ...(v.documentNumber.trim() ? { documentNumber: v.documentNumber } : {}) });
    if (!parsed.success) { a.setError(parsed.error.issues[0]?.message ?? "Dados inválidos."); return; }
    a.run(() => updateChurchAction(parsed.data));
  };
  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-4" noValidate>
      <FormField label="Nome da igreja" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={160} />
      <FormField label="Razão social (opcional)" value={v.legalName} onChange={(e) => setV({ ...v, legalName: e.target.value })} maxLength={200} />
      <FormField label="CNPJ (opcional)" inputMode="numeric" value={v.documentNumber} onChange={(e) => setV({ ...v, documentNumber: e.target.value })} maxLength={20} />
      <FormField label="Fuso horário (ex.: America/Sao_Paulo)" value={v.timezone} onChange={(e) => setV({ ...v, timezone: e.target.value })} />
      <Feedback error={a.error} saved={a.saved} />
      <Button type="submit" disabled={a.pending}>{a.pending ? "Salvando…" : "Salvar dados da igreja"}</Button>
    </form>
  );
}

export function DsrForm() {
  const a = useAction();
  const [kind, setKind] = useState<(typeof DSR_KINDS)[number]>("access");
  const [details, setDetails] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); a.run(() => createDsrAction({ kind, ...(details.trim() ? { details } : {}) }), () => setDetails("")); }} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium">Tipo de pedido
        <select value={kind} onChange={(e) => setKind(e.target.value as (typeof DSR_KINDS)[number])} className="min-h-11 rounded-controle border border-borda bg-superficie px-3 text-texto">
          {DSR_KINDS.map((k) => <option key={k} value={k}>{DSR_KIND_LABEL[k]}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">Detalhes (opcional)
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} rows={3} className="rounded-controle border border-borda bg-superficie px-3 py-2 text-texto" />
      </label>
      <Feedback error={a.error} saved={a.saved} />
      <Button type="submit" disabled={a.pending}>{a.pending ? "Enviando…" : "Enviar pedido"}</Button>
    </form>
  );
}

export function DsrAdminRow({ id, requester, kind, status, statusLabel, details, due }: { id: string; requester: string; kind: string; status: string; statusLabel: string; details: string | null; due: string }) {
  const a = useAction();
  const closed = status === "done" || status === "rejected";
  return (
    <li className="py-3">
      <p className="font-medium">{requester} · {kind}</p>
      <p className="text-sm text-texto-2">{statusLabel} · prazo {due}</p>
      {details ? <p className="mt-1 text-sm">{details}</p> : null}
      {!closed ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {status === "open" ? <Button type="button" variant="secondary" disabled={a.pending} onClick={() => a.run(() => resolveDsrAction({ requestId: id, status: "in_progress" }))}>Iniciar</Button> : null}
          <Button type="button" disabled={a.pending} onClick={() => a.run(() => resolveDsrAction({ requestId: id, status: "done" }))}>Concluir</Button>
          <Button type="button" variant="secondary" disabled={a.pending} onClick={() => a.run(() => resolveDsrAction({ requestId: id, status: "rejected" }))}>Recusar</Button>
        </div>
      ) : null}
      <Feedback error={a.error} saved={false} />
    </li>
  );
}
