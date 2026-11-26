"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { declareUnavailabilityAction, removeUnavailabilityAction } from "@/modules/availability/actions";
import { DeclareUnavailabilitySchema, WEEKDAY_LABELS } from "@/modules/availability/schemas";

export function AvailabilityForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [days, setDays] = useState<readonly number[]>([]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = DeclareUnavailabilitySchema.safeParse({ from, to, weekdays: [...days], ...(reason.trim() ? { reason } : {}) });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Dados inválidos."); return; }
    setError(null);
    start(async () => {
      const r = await declareUnavailabilityAction(parsed.data);
      if (r.ok) { setFrom(""); setTo(""); setReason(""); setDays([]); router.refresh(); } else setError(r.error.message);
    });
  };
  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-4" noValidate>
      <FormField label="De" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      <FormField label="Até" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-1 text-sm font-medium">Somente nestes dias da semana (opcional)</legend>
        {WEEKDAY_LABELS.map((label, i) => (
          <label key={label} className="flex min-h-11 items-center gap-1.5 rounded-controle border border-linha px-3 text-sm">
            <input type="checkbox" checked={days.includes(i)} onChange={(e) => setDays(e.target.checked ? [...days, i] : days.filter((d) => d !== i))} />
            {label}
          </label>
        ))}
      </fieldset>
      <FormField label="Motivo (visível apenas para você e líderes autorizados)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      {error ? <p role="alert" className="text-sm text-vinho">{error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Registrar indisponibilidade"}</Button>
    </form>
  );
}

export function RemoveUnavailabilityButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="secondary" disabled={pending} onClick={() => start(async () => { await removeUnavailabilityAction({ id }); router.refresh(); })}>
      Remover
    </Button>
  );
}
