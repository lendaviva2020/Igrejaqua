import "server-only";
import { z } from "zod";
import { mapMercadoPagoStatus, type ChargeStatus } from "./charge-status";

const API = "https://api.mercadopago.com";
const TIMEOUT_MS = 15_000;

/** Credencial da conta Mercado Pago DA IGREJA (obtida por OAuth; ver modules/contributions/mp-accounts-store). */
export interface MercadoPagoConfig { readonly accessToken: string }

/**
 * Segredo de assinatura dos webhooks do APLICATIVO do IGREJAQUA no Mercado Pago (não é dinheiro de
 * ninguém: só autentica os avisos). null = webhooks desligados (a cobrança é reconsultada na API).
 */
export function mercadoPagoWebhookSecret(env: Readonly<Record<string, string | undefined>> = process.env): string | null {
  const parsed = z.string().min(8).safeParse(env["MERCADOPAGO_WEBHOOK_SECRET"]?.trim());
  return parsed.success ? parsed.data : null;
}

export class MercadoPagoError extends Error {
  constructor(message: string, readonly httpStatus: number | null) {
    super(message);
    this.name = "MercadoPagoError";
  }
}

const PaymentSchema = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  status: z.string(),
  status_detail: z.string().nullish(),
  transaction_amount: z.number(),
  external_reference: z.string().nullish(),
  date_of_expiration: z.string().nullish(),
  date_approved: z.string().nullish(),
  point_of_interaction: z.object({ transaction_data: z.object({ qr_code: z.string().nullish(), ticket_url: z.string().nullish() }).nullish() }).nullish(),
});

export interface ProviderPayment {
  readonly providerPaymentId: string;
  readonly status: ChargeStatus;
  readonly amountCents: number;
  readonly externalReference: string | null;
  readonly qrCode: string | null;
  readonly ticketUrl: string | null;
  readonly expiresAt: string | null;
  readonly approvedAt: string | null;
}

function toProviderPayment(raw: unknown): ProviderPayment {
  const p = PaymentSchema.parse(raw);
  return {
    providerPaymentId: p.id,
    status: mapMercadoPagoStatus(p.status, p.status_detail),
    amountCents: Math.round(p.transaction_amount * 100),
    externalReference: p.external_reference ?? null,
    qrCode: p.point_of_interaction?.transaction_data?.qr_code ?? null,
    ticketUrl: p.point_of_interaction?.transaction_data?.ticket_url ?? null,
    expiresAt: p.date_of_expiration ?? null,
    approvedAt: p.date_approved ?? null,
  };
}

async function call(cfg: MercadoPagoConfig, path: string, init: { method: "GET" | "POST"; body?: string; idempotencyKey?: string }): Promise<unknown> {
  const headers: Record<string, string> = { Authorization: `Bearer ${cfg.accessToken}`, "Content-Type": "application/json", Accept: "application/json" };
  if (init.idempotencyKey) headers["X-Idempotency-Key"] = init.idempotencyKey;
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { method: init.method, headers, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store", ...(init.body !== undefined ? { body: init.body } : {}) });
  } catch (cause) {
    throw new MercadoPagoError(cause instanceof Error && cause.name === "TimeoutError" ? "Tempo esgotado ao falar com o Mercado Pago." : "Falha de rede ao falar com o Mercado Pago.", null);
  }
  if (!res.ok) {
    // Nunca registrar corpo/token: pode conter dados do pagador.
    throw new MercadoPagoError(`Mercado Pago respondeu HTTP ${res.status}.`, res.status);
  }
  return res.json() as Promise<unknown>;
}

/** Offset fixo -03:00 (Brasil sem horário de verão desde 2019), no formato exigido pela API. */
function formatExpiration(date: Date): string {
  const local = new Date(date.getTime() - 3 * 3600_000);
  return `${local.toISOString().slice(0, 23)}-03:00`;
}

export interface CreatePixInput {
  readonly amountCents: number;
  readonly description: string;
  readonly payerEmail: string;
  readonly externalReference: string;
  readonly idempotencyKey: string;
  readonly notificationUrl: string | null;
  readonly expiresInMinutes: number;
}

export async function createPixPayment(cfg: MercadoPagoConfig, input: CreatePixInput): Promise<ProviderPayment> {
  const body = {
    transaction_amount: input.amountCents / 100,
    description: input.description,
    payment_method_id: "pix",
    payer: { email: input.payerEmail },
    external_reference: input.externalReference,
    date_of_expiration: formatExpiration(new Date(Date.now() + input.expiresInMinutes * 60_000)),
    ...(input.notificationUrl ? { notification_url: input.notificationUrl } : {}),
  };
  const raw = await call(cfg, "/v1/payments", { method: "POST", body: JSON.stringify(body), idempotencyKey: input.idempotencyKey });
  const payment = toProviderPayment(raw);
  if (!payment.qrCode) throw new MercadoPagoError("Resposta do Mercado Pago sem código Pix.", null);
  return payment;
}

export async function getPayment(cfg: MercadoPagoConfig, providerPaymentId: string): Promise<ProviderPayment> {
  if (!/^\d{1,20}$/.test(providerPaymentId)) throw new MercadoPagoError("Identificador de pagamento inválido.", null);
  return toProviderPayment(await call(cfg, `/v1/payments/${providerPaymentId}`, { method: "GET" }));
}

const RefundSchema = z.object({ id: z.union([z.number(), z.string()]).transform(String) });

/**
 * Estorno TOTAL (corpo vazio = valor integral). A chave de idempotência torna a repetição segura:
 * o provedor devolve o mesmo estorno em vez de criar outro. O status local só muda após reconsultar o pagamento.
 */
export async function refundPayment(cfg: MercadoPagoConfig, providerPaymentId: string, idempotencyKey: string): Promise<{ readonly refundId: string }> {
  if (!/^\d{1,20}$/.test(providerPaymentId)) throw new MercadoPagoError("Identificador de pagamento inválido.", null);
  const raw = await call(cfg, `/v1/payments/${providerPaymentId}/refunds`, { method: "POST", body: "{}", idempotencyKey });
  return { refundId: RefundSchema.parse(raw).id };
}
