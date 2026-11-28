import { NextResponse, type NextRequest } from "next/server";
import { webVitalSchema } from "@/lib/perf/web-vitals";

const MAX_BODY_BYTES = 1024;
const NO_STORE = { "cache-control": "no-store" } as const;

/**
 * Recebe uma métrica de desempenho do navegador e grava uma linha de log estruturada (logs de runtime
 * da Vercel). Não lê cookies nem sessão, não grava no banco e não registra IP, user-agent ou ids.
 * Pedidos de outros sites são recusados para evitar poluição dos dados.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (request.headers.get("sec-fetch-site") === "cross-site") return new NextResponse(null, { status: 403, headers: NO_STORE });
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return new NextResponse(null, { status: 413, headers: NO_STORE });

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return new NextResponse(null, { status: 400, headers: NO_STORE });
  }
  if (raw.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 413, headers: NO_STORE });

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400, headers: NO_STORE });
  }
  const parsed = webVitalSchema.safeParse(json);
  if (!parsed.success) return new NextResponse(null, { status: 422, headers: NO_STORE });

  console.info(JSON.stringify({ event: "web_vital", ...parsed.data }));
  return new NextResponse(null, { status: 204, headers: NO_STORE });
}
