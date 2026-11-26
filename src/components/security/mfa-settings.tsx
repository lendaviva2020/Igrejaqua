"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { confirmTotpEnrollmentAction, removeTotpFactorAction, startTotpEnrollmentAction, type TotpEnrollment } from "@/modules/security/actions";

interface Props { readonly factorId: string | null; readonly promptEnrollment: boolean; readonly redirectTo?: string }

export function MfaSettings({ factorId, promptEnrollment, redirectTo }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const begin = () => {
    setError(null);
    start(async () => {
      const r = await startTotpEnrollmentAction();
      if (r.ok) setEnrollment(r.data); else setError(r.error.message);
    });
  };
  const confirm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (enrollment === null) return;
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    setError(null);
    start(async () => {
      const r = await confirmTotpEnrollmentAction({ factorId: enrollment.factorId, code });
      if (r.ok) { setEnrollment(null); if (redirectTo !== undefined) router.replace(redirectTo); router.refresh(); } else setError(r.error.message);
    });
  };
  const remove = () => {
    if (factorId === null) return;
    setError(null);
    start(async () => {
      const r = await removeTotpFactorAction({ factorId });
      if (r.ok) router.refresh(); else setError(r.error.message);
    });
  };

  return (
    <div className="max-w-md rounded-superficie border border-linha bg-superficie p-4">
      {factorId !== null ? (
        <>
          <p className="font-medium">Verificação em duas etapas ativa</p>
          <p className="mt-1 text-sm text-texto-2">Ao entrar, você digitará o código do aplicativo autenticador.</p>
          <button type="button" onClick={remove} disabled={pending} className="mt-3 min-h-11 rounded-full border border-linha px-5 font-semibold disabled:opacity-60">Remover autenticador</button>
        </>
      ) : enrollment === null ? (
        <>
          <p className="font-medium">Verificação em duas etapas</p>
          <p className="mt-1 text-sm text-texto-2">{promptEnrollment ? "Como administrador, a verificação em duas etapas é obrigatória. Proteja a conta com um aplicativo autenticador (Google Authenticator, Authy, 1Password…)." : "Proteja a conta com um aplicativo autenticador."}</p>
          <button type="button" onClick={begin} disabled={pending} className="mt-3 min-h-11 rounded-full bg-ambar px-5 font-semibold text-fundo disabled:opacity-60">Configurar</button>
        </>
      ) : (
        <form onSubmit={confirm} className="flex flex-col gap-3" noValidate>
          <p className="text-sm text-texto-2">Escaneie o QR code no aplicativo autenticador e digite o código gerado.</p>
          {/* data: URI SVG gerado pelo Supabase Auth; CSP libera img-src data: */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrollment.qrSvg} alt="QR code para o aplicativo autenticador" width={176} height={176} className="size-44 self-center rounded-xl bg-white p-2" />
          <p className="text-xs text-texto-2">Sem câmera? Chave manual: <code className="break-all font-mono text-texto">{enrollment.secret}</code></p>
          <label className="flex flex-col gap-1 text-sm font-medium" htmlFor="mfa-code">
            Código de 6 números
            <input id="mfa-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={7} required className="min-h-12 rounded-xl border border-linha bg-fundo px-4 font-mono text-lg tracking-widest" />
          </label>
          <button type="submit" disabled={pending} className="min-h-12 rounded-full bg-ambar font-semibold text-fundo disabled:opacity-60">Ativar</button>
        </form>
      )}
      {error ? <p role="alert" className="mt-2 text-sm text-perigo">{error}</p> : null}
    </div>
  );
}
