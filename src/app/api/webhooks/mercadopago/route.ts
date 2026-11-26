import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { mercadoPagoConfig, MercadoPagoError } from "@/lib/payments/mercadopago";
import { verifyMercadoPagoSignature } from "@/lib/payments/mercadopago-signature";
import { syncChargeFromProvider } from "@/modules/contributions/sync";

export const dynamic = "force-dynamic";

const Body = z.object({ type: z.string().optional(), data: z.object({ id: z.union([z.string(), z.number()]).transform(String) }).optional() });

/** Webhook do Mercado Pago. 401 se a assinatura falhar; 503 se o Pix não estiver configurado; 500 faz o provedor reenviar. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const cfg = mercadoPagoConfig();
  if (cfg === null) return NextResponse.json({ ok: false }, { status: 503 });

  const url = new URL(request.url);
  const rawBody: unknown = await request.json().catch(() => null);
  const body = Body.safeParse(rawBody);
  const dataId = url.searchParams.get("data.id") ?? (body.success ? (body.data.data?.id ?? null) : null);

  const valid = verifyMercadoPagoSignature({
    xSignature: request.headers.get("x-signature"),
    xRequestId: request.headers.get("x-request-id"),
    dataId: url.searchParams.get("data.id"),
    secret: cfg.webhookSecret,
  });
  if (!valid) return NextResponse.json({ ok: false }, { status: 401 });

  const type = url.searchParams.get("type") ?? (body.success ? body.data.type : undefined);
  if (type !== "payment" || dataId === null) return NextResponse.json({ ok: true, ignored: true });

  try {
    const outcome = await syncChargeFromProvider(cfg, dataId);
    return NextResponse.json({ ok: true, outcome });
  } catch (cause) {
    console.error("mp_webhook_failed", cause instanceof MercadoPagoError ? cause.message : "erro interno");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
