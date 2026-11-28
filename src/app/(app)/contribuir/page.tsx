import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { resolveChurchContext } from "@/lib/auth/context";
import { CHARGE_STATUS_LABEL } from "@/lib/payments/charge-status";
import { formatCents } from "@/lib/payments/money";
import { getPaymentSetup } from "@/modules/contributions/payment-method";
import { getChurchTimezone } from "@/modules/events/queries";
import { listCharges, memberNames } from "@/modules/contributions/queries";
import { PURPOSE_LABEL } from "@/modules/contributions/schemas";
import { ChargeForm } from "./charge-form";

export const metadata: Metadata = { title: "Contribuir" };

export default async function ContributePage() {
  const ctx = await resolveChurchContext();
  const isAdmin = ctx.role === "admin";
  const [charges, tz, names, setup] = await Promise.all([listCharges(ctx.churchId), getChurchTimezone(ctx.churchId), isAdmin ? memberNames(ctx.churchId) : Promise.resolve(new Map<string, string>()), getPaymentSetup(ctx.churchId)]);
  // Mercado Pago da igreja (automático) tem prioridade; senão a chave Pix da igreja (a tesouraria confirma).
  const method = setup.mercadoPago !== null ? "mercadopago" : setup.pixKey !== null ? "pix_key" : "none";
  const enabled = method !== "none";
  const awaitingReview = isAdmin ? charges.filter((c) => c.provider === "pix_key" && c.status === "pending").length : 0;
  const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz });
  const approvedTotal = charges.filter((c) => c.status === "approved").reduce((sum, c) => sum + c.amount_cents, 0);
  return (
    <>
      <PageHeader title="Contribuir" description={method === "mercadopago" ? "Ofertas e dízimos via Pix, direto para a conta da igreja, com confirmação automática." : "Ofertas e dízimos via Pix, direto para a conta da igreja."} />
      {awaitingReview > 0 ? <p role="status" className="mb-6 rounded-superficie border border-ambar/60 bg-superficie p-4 text-sm"><strong>{awaitingReview === 1 ? "1 contribuição aguarda" : `${awaitingReview} contribuições aguardam`} a sua conferência.</strong> Abra cada uma, confira no extrato do banco da igreja e confirme o recebimento.</p> : null}
      {enabled ? (
        <section aria-labelledby="novo" className="mb-10"><h2 id="novo" className="mb-3 text-2xl">Nova contribuição</h2><ChargeForm /></section>
      ) : (
        <EmptyState title="Contribuições online ainda não disponíveis">
          {isAdmin ? <>Cadastre a chave Pix da igreja em <Link className="text-ambar-claro underline" href="/configuracoes#contribuicoes">Configurações, Contribuições</Link>. O dinheiro vai direto para a conta da igreja.</> : "A administração da igreja ainda não ativou este recurso."}
        </EmptyState>
      )}
      <section aria-labelledby="hist" className="mt-10">
        <h2 id="hist" className="mb-3 text-2xl">{isAdmin ? "Contribuições da igreja" : "Minhas contribuições"}</h2>
        {isAdmin && charges.length > 0 ? <p className="mb-3 text-sm text-texto-2">Confirmadas neste período listado: <span className="tabular font-semibold text-texto">{formatCents(approvedTotal)}</span></p> : null}
        {charges.length === 0 ? <EmptyState title="Nenhuma contribuição">Quando houver contribuições, elas aparecerão aqui.</EmptyState> : (
          <ul className="flex flex-col gap-3">
            {charges.map((c) => (
              <li key={c.id}>
                <Link href={`/contribuir/${c.id}`} className="flex items-center justify-between gap-4 rounded-superficie border border-linha bg-superficie p-4 hover:bg-superficie-2">
                  <span className="min-w-0">
                    <span className="block font-semibold">{PURPOSE_LABEL[c.purpose]} · <span className="tabular">{formatCents(c.amount_cents)}</span></span>
                    <span className="block truncate text-sm text-texto-2">{isAdmin ? `${names.get(c.membership_id) ?? "Membro"} · ` : ""}<time dateTime={c.created_at}>{fmt.format(new Date(c.created_at))}</time></span>
                  </span>
                  <span className={c.status === "approved" ? "text-sm text-sucesso" : c.status === "pending" ? "text-sm text-ambar-claro" : "text-sm text-texto-2"}>{c.provider === "pix_key" && c.status === "pending" ? (isAdmin ? "Conferir recebimento" : "Aguardando confirmação") : CHARGE_STATUS_LABEL[c.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
