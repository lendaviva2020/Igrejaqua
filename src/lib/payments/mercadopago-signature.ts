import { createHmac, timingSafeEqual } from "node:crypto";

export interface WebhookSignatureInput {
  readonly xSignature: string | null;
  readonly xRequestId: string | null;
  /** Valor do query param `data.id`. */
  readonly dataId: string | null;
  readonly secret: string;
}

/**
 * Valida a assinatura de webhook do Mercado Pago: HMAC-SHA256 (hex) do manifesto
 * `id:<data.id minúsculo>;request-id:<x-request-id>;ts:<ts>;` (pares ausentes são omitidos),
 * chave = segredo da aplicação, comparado em tempo constante com `v1` do header `x-signature`.
 */
export function verifyMercadoPagoSignature({ xSignature, xRequestId, dataId, secret }: WebhookSignatureInput): boolean {
  if (!xSignature || secret.length === 0) return false;
  let ts: string | undefined;
  let v1: string | undefined;
  for (const part of xSignature.split(",")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "ts") ts = value;
    else if (key === "v1") v1 = value;
  }
  if (!ts || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) return false;
  const manifest = `${dataId ? `id:${dataId.toLowerCase()};` : ""}${xRequestId ? `request-id:${xRequestId};` : ""}ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest();
  const received = Buffer.from(v1, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
