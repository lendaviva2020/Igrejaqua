import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { resolveChurchContext } from "@/lib/auth/context";
import { CHARGE_STATUS_LABEL } from "@/lib/payments/charge-status";
import { formatCents } from "@/lib/payments/money";
import { mercadoPagoConfig } from "@/lib/payments/mercadopago";
import { getChurchTimezone } from "@/modules/events/queries";
import { listCharges, memberNames } from "@/modules/contributions/queries";
import { PURPOSE_LABEL } from "@/modules/contributions/schemas";
import { ChargeForm } from "./charge-form";

export const metadata: Metadata = { title: "Contribuir" };

export default async function ContributePage() {
  const ctx = await resolveChurchContext();
  const enabled = mercadoPagoConfig() !== null;
  const isAdmin = ctx.role === "admin";
  const [charges, tz, names] = await Promise.all([listCharges(ctx.churchId), getChurchTimezone(ctx.churchId), isAdmin ? memberNames(ctx.churchId) : Promise.resolve(new Map<string, string>())]);
  const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz });
  const approvedTotal = charges.filter((c) => c.status === "approved").reduce((sum, c) => sum + c.amount_cents, 0);
  return (
    <>
      <PageHeader title="Contribuir" description="Ofertas e contribuições via Pix, com confirmação automática." />
      {enabled ? (
        <section aria-labelledby="novo" className="mb-10"><h2 id="novo" className="mb-3 text-2xl">Nova contribuição</h2><ChargeForm /></section>
      ) : (
        <EmptyState title="Contribuições online ainda não disponíveis">
          {isAdmin ? "Configure MERCADOPAGO_ACCESS_TOKEN e MERCADOPAGO_WEBHOOK_SECRET no servidor para ativar o Pix." : "A administração da igreja ainda não ativou este recurso."}
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
                  <span className={c.status === "approved" ? "text-sm text-sucesso" : c.status === "pending" ? "text-sm text-ambar-claro" : "text-sm text-texto-2"}>{CHARGE_STATUS_LABEL[c.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
