"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ActionButton, ActionForm, CheckField, Field, SelectField, TextAreaField } from "@/components/shared/action-form";
import { addFollowupAction, createVisitorAction, deleteVisitorAction, setVisitorStatusAction } from "@/modules/visitors/actions";
import { FOLLOWUP_KINDS, FOLLOWUP_KIND_LABEL, VISITOR_STATUSES, VISITOR_STATUS_LABEL, type VisitorStatus } from "@/modules/visitors/schemas";

export function NewVisitorForm() {
  return (
    <ActionForm action={createVisitorAction} submitLabel="Cadastrar visitante" booleans={["contactConsent"]}>
      <Field label="Nome" name="fullName" />
      <Field label="Telefone (opcional)" name="phone" type="tel" autoComplete="off" />
      <Field label="E-mail (opcional)" name="email" type="email" autoComplete="off" />
      <CheckField label="A pessoa autorizou guardarmos o telefone/e-mail para contato" name="contactConsent" />
      <Field label="Como conheceu a igreja (opcional)" name="source" />
      <TextAreaField label="Observações (opcional)" name="notes" maxLength={1000} />
    </ActionForm>
  );
}

export function FollowupForm({ visitorId }: { readonly visitorId: string }) {
  return (
    <ActionForm action={addFollowupAction} submitLabel="Registrar" extra={{ visitorId }} className="mt-2 flex max-w-md flex-col gap-4">
      <SelectField label="Tipo de contato" name="kind" defaultValue="ligacao">{FOLLOWUP_KINDS.map((k) => <option key={k} value={k}>{FOLLOWUP_KIND_LABEL[k]}</option>)}</SelectField>
      <TextAreaField label="O que foi conversado" name="note" maxLength={1000} />
    </ActionForm>
  );
}

export function StatusSelect({ visitorId, status }: { readonly visitorId: string; readonly status: VisitorStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-end gap-1">
      <label className="sr-only" htmlFor={`st-${visitorId}`}>Situação</label>
      <select id={`st-${visitorId}`} defaultValue={status} disabled={pending} className="min-h-11 rounded-controle border border-borda bg-fundo px-3 text-sm"
        onChange={(e) => { const next = VISITOR_STATUSES.find((s) => s === e.target.value); if (next === undefined) return; setError(null); start(async () => { const r = await setVisitorStatusAction({ visitorId, status: next }); if (r.ok) router.refresh(); else setError(r.error.message); }); }}>
        {VISITOR_STATUSES.map((s) => <option key={s} value={s}>{VISITOR_STATUS_LABEL[s]}</option>)}
      </select>
      {error ? <span role="alert" className="text-xs text-perigo">{error}</span> : null}
    </span>
  );
}

export const DeleteVisitorButton = ({ visitorId }: { readonly visitorId: string }) => <ActionButton action={deleteVisitorAction} input={{ visitorId }} label="Apagar dados" variant="danger" confirmMessage="Apagar este visitante e todos os contatos registrados? Não dá para desfazer." />;
