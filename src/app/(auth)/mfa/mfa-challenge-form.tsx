"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { verifyMfaChallengeAction } from "@/modules/security/actions";

export function MfaChallengeForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    setError(null);
    start(async () => {
      const r = await verifyMfaChallengeAction({ code });
      if (r.ok) { router.replace("/dashboard"); router.refresh(); } else setError(r.error.message);
    });
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="text-2xl">Verificação em duas etapas</h1>
        <p className="mt-1 text-sm text-texto-2">Abra o aplicativo autenticador e digite o código de 6 números.</p>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium" htmlFor="code">
        Código
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={7} required autoFocus className="min-h-12 rounded-xl border border-linha bg-fundo px-4 font-mono text-lg tracking-widest" aria-describedby={error ? "mfa-error" : undefined} />
      </label>
      {error ? <p id="mfa-error" role="alert" className="text-sm text-perigo">{error}</p> : null}
      <button type="submit" disabled={pending} className="min-h-12 rounded-full bg-ambar font-semibold text-fundo disabled:opacity-60">{pending ? "Verificando…" : "Verificar"}</button>
    </form>
  );
}
