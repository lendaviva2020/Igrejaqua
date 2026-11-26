"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { refreshChargeAction, refundChargeAction } from "@/modules/contributions/actions";

export function ChargeActions({ chargeId, qrCode, pending: isPending, canRefund }: { chargeId: string; qrCode: string | null; pending: boolean; canRefund: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = () => start(async () => {
    const r = await refreshChargeAction({ chargeId });
    setMessage(r.ok ? null : r.error.message);
    router.refresh();
  });

  const [confirming, setConfirming] = useState(false);
  const refund = () => start(async () => {
    const r = await refundChargeAction({ chargeId });
    setMessage(r.ok ? null : r.error.message);
    setConfirming(false);
    router.refresh();
  });

  // Consulta automática a cada 8 s por até ~5 min enquanto aguarda (webhook é o caminho principal; isto é o reforço).
  useEffect(() => {
    if (!isPending) return;
    let tries = 0;
    const id = window.setInterval(() => { tries += 1; if (tries > 37) { window.clearInterval(id); return; } void refreshChargeAction({ chargeId }).then(() => router.refresh()); }, 8000);
    return () => window.clearInterval(id);
  }, [isPending, chargeId, router]);

  return (
    <div className="flex flex-col gap-3">
      {qrCode ? (
        <Button type="button" onClick={() => { void navigator.clipboard.writeText(qrCode).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2500); }); }}>
          {copied ? "Código copiado!" : "Copiar código Pix (copia e cola)"}
        </Button>
      ) : null}
      {isPending ? <Button type="button" variant="secondary" disabled={busy} onClick={refresh}>{busy ? "Verificando…" : "Já paguei — verificar"}</Button> : null}
      {canRefund ? (
        confirming ? (
          <div className="flex flex-col gap-2 rounded-superficie border border-perigo/60 p-4">
            <p className="text-sm">Estornar o valor integral ao contribuinte? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-2">
              <Button type="button" variant="danger" disabled={busy} onClick={refund}>{busy ? "Estornando…" : "Confirmar estorno"}</Button>
              <Button type="button" variant="quiet" disabled={busy} onClick={() => setConfirming(false)}>Cancelar</Button>
            </div>
          </div>
        ) : <Button type="button" variant="quiet" onClick={() => setConfirming(true)}>Estornar contribuição</Button>
      ) : null}
      <p role="status" aria-live="polite" className="text-sm text-perigo">{message}</p>
    </div>
  );
}
