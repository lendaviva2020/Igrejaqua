import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { canTransition, mapMercadoPagoStatus } from "@/lib/payments/charge-status";
import { formatCents, parseBrlToCents } from "@/lib/payments/money";
import { verifyMercadoPagoSignature } from "@/lib/payments/mercadopago-signature";
import { CreateChargeSchema } from "@/modules/contributions/schemas";

vi.mock("server-only", () => ({}));

const secret = "segredo-de-teste-123";
const sign = (manifest: string): string => createHmac("sha256", secret).update(manifest).digest("hex");

describe("assinatura do webhook Mercado Pago", () => {
  const base = { xRequestId: "req-1", dataId: "ABC123", secret } as const;
  it("aceita assinatura válida (id em minúsculas no manifesto)", () => {
    const v1 = sign("id:abc123;request-id:req-1;ts:1742505638683;");
    expect(verifyMercadoPagoSignature({ ...base, xSignature: `ts=1742505638683,v1=${v1}` })).toBe(true);
  });
  it("omite pares ausentes do manifesto", () => {
    const v1 = sign("ts:1700000000;");
    expect(verifyMercadoPagoSignature({ xSignature: `ts=1700000000,v1=${v1}`, xRequestId: null, dataId: null, secret })).toBe(true);
  });
  it("rejeita corpo adulterado (outro data.id)", () => {
    const v1 = sign("id:abc123;request-id:req-1;ts:1;");
    expect(verifyMercadoPagoSignature({ ...base, dataId: "OUTRO", xSignature: `ts=1,v1=${v1}` })).toBe(false);
  });
  it("rejeita segredo errado, header ausente ou malformado", () => {
    const v1 = sign("id:abc123;request-id:req-1;ts:1;");
    expect(verifyMercadoPagoSignature({ ...base, secret: "outro-segredo", xSignature: `ts=1,v1=${v1}` })).toBe(false);
    expect(verifyMercadoPagoSignature({ ...base, xSignature: null })).toBe(false);
    expect(verifyMercadoPagoSignature({ ...base, xSignature: "ts=1,v1=zz" })).toBe(false);
    expect(verifyMercadoPagoSignature({ ...base, xSignature: `v1=${v1}` })).toBe(false);
  });
});

describe("status de cobrança", () => {
  it("mapeia estados do provedor; desconhecido nunca aprova", () => {
    expect(mapMercadoPagoStatus("approved")).toBe("approved");
    expect(mapMercadoPagoStatus("in_process")).toBe("pending");
    expect(mapMercadoPagoStatus("algo_novo")).toBe("pending");
    expect(mapMercadoPagoStatus("cancelled", "expired")).toBe("expired");
    expect(mapMercadoPagoStatus("charged_back")).toBe("refunded");
  });
  it("estados finais não retrocedem; aprovado só estorna", () => {
    expect(canTransition("pending", "approved")).toBe(true);
    expect(canTransition("approved", "pending")).toBe(false);
    expect(canTransition("approved", "refunded")).toBe(true);
    expect(canTransition("rejected", "approved")).toBe(false);
    expect(canTransition("approved", "approved")).toBe(false);
  });
});

describe("valores em reais", () => {
  it("converte para centavos sem ponto flutuante", () => {
    expect(parseBrlToCents("50")).toBe(5000);
    expect(parseBrlToCents("50,5")).toBe(5050);
    expect(parseBrlToCents("1.250,00")).toBe(125000);
    expect(parseBrlToCents("R$ 19,99")).toBe(1999);
    expect(parseBrlToCents("0,1")).toBe(10);
  });
  it("rejeita lixo", () => {
    for (const bad of ["", "abc", "-5", "1,234", "10,0,0", "1e3"]) expect(parseBrlToCents(bad)).toBeNull();
  });
  it("formata em BRL", () => expect(formatCents(125000).replace(/\s/g, " ")).toMatch(/R\$\s?1\.250,00/));
  it("schema impõe limites e strict", () => {
    expect(CreateChargeSchema.safeParse({ amount: "50", purpose: "oferta" })).toMatchObject({ success: true, data: { amountCents: 5000 } });
    expect(CreateChargeSchema.safeParse({ amount: "0,50", purpose: "oferta" }).success).toBe(false);
    expect(CreateChargeSchema.safeParse({ amount: "50001", purpose: "oferta" }).success).toBe(false);
    expect(CreateChargeSchema.safeParse({ amount: "50", purpose: "oferta", churchId: "x" }).success).toBe(false);
    expect(CreateChargeSchema.safeParse({ amount: "50", purpose: "inexistente" }).success).toBe(false);
  });
});

describe("cliente Mercado Pago (fetch simulado)", () => {
  afterEach(() => vi.unstubAllGlobals());
  const cfg = { accessToken: "APP_USR-token-de-teste-123456", webhookSecret: secret };
  const input = { amountCents: 5000, description: "Oferta", payerEmail: "a@b.co", externalReference: "11111111-1111-4111-8111-111111111111", idempotencyKey: "22222222-2222-4222-8222-222222222222", notificationUrl: "https://ex.com/api/webhooks/mercadopago", expiresInMinutes: 30 };

  it("envia Pix com idempotência, valor em reais e expiração -03:00; lê o QR da resposta", async () => {
    const { createPixPayment } = await import("@/lib/payments/mercadopago");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 5466310457, status: "pending", transaction_amount: 50, external_reference: input.externalReference, point_of_interaction: { transaction_data: { qr_code: "000201...", ticket_url: "https://mp/ticket" } } }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const p = await createPixPayment(cfg, input);
    expect(p).toMatchObject({ providerPaymentId: "5466310457", status: "pending", amountCents: 5000, qrCode: "000201..." });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.mercadopago.com/v1/payments");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Idempotency-Key"]).toBe(input.idempotencyKey);
    expect(headers["Authorization"]).toBe(`Bearer ${cfg.accessToken}`);
    const body = JSON.parse(String(init.body)) as { transaction_amount: number; payment_method_id: string; date_of_expiration: string; notification_url: string };
    expect(body).toMatchObject({ transaction_amount: 50, payment_method_id: "pix", notification_url: input.notificationUrl });
    expect(body.date_of_expiration).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}-03:00$/);
  });

  it("falha sem vazar corpo/token quando o provedor recusa", async () => {
    const { createPixPayment } = await import("@/lib/payments/mercadopago");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "dados sensíveis do pagador" }), { status: 400 })));
    const err = await createPixPayment(cfg, input).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(String((err as Error).message)).not.toContain("sensíveis");
    expect(String((err as Error).message)).not.toContain(cfg.accessToken);
  });

  it("recusa resposta sem código Pix e id de pagamento inválido", async () => {
    const { createPixPayment, getPayment } = await import("@/lib/payments/mercadopago");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 1, status: "pending", transaction_amount: 50 }), { status: 201 })));
    await expect(createPixPayment(cfg, input)).rejects.toThrow(/sem código Pix/);
    await expect(getPayment(cfg, "../admin")).rejects.toThrow(/inválido/);
  });
});
