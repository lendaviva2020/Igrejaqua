"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { createPixChargeAction } from "@/modules/contributions/actions";
import { CreateChargeSchema, PURPOSES, PURPOSE_LABEL } from "@/modules/contributions/schemas";

const PRESETS = ["50", "100", "200"] as const;

export function ChargeForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("50");
  const [purpose, setPurpose] = useState<(typeof PURPOSES)[number]>("oferta");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = CreateChargeSchema.safeParse({ amount, purpose });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Dados inválidos."); return; }
    setError(null);
    start(async () => {
      const r = await createPixChargeAction({ amount, purpose });
      if (r.ok) router.push(`/contribuir/${r.data.chargeId}`); else setError(r.error.message);
    });
  };
  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-4" noValidate>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-1 text-sm font-medium">Valor</legend>
        {PRESETS.map((v) => (
          <button key={v} type="button" aria-pressed={amount === v} onClick={() => setAmount(v)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${amount === v ? "border-ambar bg-ambar text-sobre-ambar" : "border-borda text-texto"}`}>R$ {v}</button>
        ))}
      </fieldset>
      <FormField label="Outro valor (R$)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <label className="flex flex-col gap-1.5 text-sm font-medium">Finalidade
        <select value={purpose} onChange={(e) => setPurpose(e.target.value as (typeof PURPOSES)[number])} className="min-h-11 rounded-controle border border-borda bg-fundo px-3 font-normal">
          {PURPOSES.map((p) => <option key={p} value={p}>{PURPOSE_LABEL[p]}</option>)}
        </select>
      </label>
      {error ? <p role="alert" className="text-sm text-perigo">{error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Gerando Pix…" : "Gerar Pix"}</Button>
    </form>
  );
}
