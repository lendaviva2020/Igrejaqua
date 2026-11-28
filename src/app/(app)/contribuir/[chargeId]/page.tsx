import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/shared/page-header";
import { QrCode } from "@/components/shared/qr-code";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { CHARGE_STATUS_LABEL } from "@/lib/payments/charge-status";
import { formatCents } from "@/lib/payments/money";
import { getCharge } from "@/modules/contributions/queries";
import { PURPOSE_LABEL } from "@/modules/contributions/schemas";
import { getChurchPixKey } from "@/modules/contributions/payment-method";
import { ChargeActions, PixKeyReview } from "./charge-actions";

export const metadata: Metadata = { title: "Pagar com Pix" };

export default async function ChargePage({ params }: { params: Promise<{ chargeId: string }> }) {
  const { chargeId } = await params;
  if (!z.string().uuid().safeParse(chargeId).success) notFound();
  const ctx = await resolveChurchContext();
  const charge = await getCharge(ctx.churchId, chargeId);
  if (charge === null) notFound();
  const pending = charge.status === "pending";
  const viaPixKey = charge.provider === "pix_key";
  const pixKey = viaPixKey && pending ? await getChurchPixKey(ctx.churchId) : null;
  return (
    <>
      <PageHeader title={`${PURPOSE_LABEL[charge.purpose]} · ${formatCents(charge.amount_cents)}`} description={viaPixKey && pending ? "Aguardando confirmação da tesouraria" : CHARGE_STATUS_LABEL[charge.status]} />
      <div className="flex max-w-md flex-col gap-6">
        {charge.status === "approved" ? <p className="rounded-superficie border border-sucesso/60 bg-superficie p-4 text-sucesso">Pagamento confirmado. Obrigado pela sua contribuição!</p> : null}
        {pending && charge.qr_code ? (
          <>
            <QrCode value={charge.qr_code} label="QR Code Pix para pagamento" />
            {viaPixKey ? (
              <>
                {pixKey !== null ? <p className="rounded-superficie border border-linha bg-superficie p-3 text-sm">O Pix vai direto para a conta da igreja. No app do seu banco, confira o recebedor: <strong>{pixKey.recipientName}</strong>.</p> : null}
                <p className="text-sm text-texto-2">Abra o app do seu banco, escolha Pix e leia o QR Code ou use o código copia e cola. Depois do pagamento, a tesouraria da igreja confere e confirma.{charge.pix_txid ? <> Identificador: <span className="font-mono">{charge.pix_txid}</span>.</> : null}</p>
              </>
            ) : <p className="text-sm text-texto-2">Abra o app do seu banco, escolha Pix e leia o QR Code ou use o código copia e cola. O pagamento é confirmado automaticamente.</p>}
          </>
        ) : null}
        {charge.status === "refunded" ? <p className="text-texto-2">Esta contribuição foi estornada.</p> : null}
        {charge.status === "expired" || charge.status === "cancelled" || charge.status === "rejected" ? <p className="text-texto-2">Esta cobrança não está mais ativa. Gere um novo Pix.</p> : null}
        {viaPixKey && pending && can(ctx, "finance.manage") ? <PixKeyReview chargeId={charge.id} /> : null}
        <ChargeActions chargeId={charge.id} qrCode={pending ? charge.qr_code : null} pending={pending && !viaPixKey} canRefund={charge.status === "approved" && !viaPixKey && can(ctx, "finance.manage")} />
        <Link href="/contribuir" className="text-sm text-ambar-claro underline">Voltar para contribuições</Link>
      </div>
    </>
  );
}
