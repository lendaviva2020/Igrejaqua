/**
 * Proxy HTTP de medição: fica entre o app e o gateway da pilha de teste (tools/e2e-stack) e
 *  1. injeta uma latência fixa por requisição, simulando a ida e volta real até o Supabase hospedado;
 *  2. conta as chamadas ao backend (Auth e REST) para provar quantas idas e voltas cada navegação faz.
 *
 * Só para medição local. Nunca aponte para produção.
 *
 * Uso: IQ_PERF_LATENCY_MS=40 node --experimental-strip-types tools/perf/latency-proxy.ts
 *   GET /__stats  → contagem desde o último reset
 *   POST /__reset → zera a contagem
 */
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from "node:http";

const LISTEN_PORT = Number(process.env["IQ_PERF_PROXY_PORT"] ?? "54402");
const TARGET_PORT = Number(process.env["IQ_PERF_TARGET_PORT"] ?? "54400");
const LATENCY_MS = Number(process.env["IQ_PERF_LATENCY_MS"] ?? "40");

if (!Number.isInteger(LISTEN_PORT) || !Number.isInteger(TARGET_PORT) || !Number.isFinite(LATENCY_MS) || LATENCY_MS < 0) {
  throw new Error("Configuração inválida: IQ_PERF_PROXY_PORT, IQ_PERF_TARGET_PORT e IQ_PERF_LATENCY_MS devem ser números não negativos.");
}

interface Stats { total: number; auth: number; rest: number; byRoute: Record<string, number> }
let stats: Stats = { total: 0, auth: 0, rest: 0, byRoute: {} };

/** Agrupa por recurso, sem query string (que pode conter ids), para o relatório ser legível. */
function routeKey(method: string, rawUrl: string): string {
  const path = rawUrl.split("?")[0] ?? rawUrl;
  return `${method} ${path}`;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function forward(req: IncomingMessage, res: ServerResponse): void {
  const upstream = httpRequest(
    { host: "127.0.0.1", port: TARGET_PORT, method: req.method, path: req.url, headers: req.headers },
    (upRes) => {
      res.writeHead(upRes.statusCode ?? 502, upRes.headers);
      upRes.pipe(res);
    },
  );
  upstream.on("error", (cause) => {
    console.error("perf_proxy_upstream_error", cause.message);
    if (!res.headersSent) sendJson(res, 502, { error: "upstream_unavailable" });
    else res.destroy(cause);
  });
  req.pipe(upstream);
}

const server = createServer((req, res) => {
  const url = req.url ?? "/";
  const method = req.method ?? "GET";
  if (url === "/__stats") return sendJson(res, 200, stats);
  if (url === "/__reset") {
    stats = { total: 0, auth: 0, rest: 0, byRoute: {} };
    return sendJson(res, 200, { ok: true });
  }
  stats.total += 1;
  if (url.startsWith("/auth/")) stats.auth += 1;
  if (url.startsWith("/rest/")) stats.rest += 1;
  const key = routeKey(method, url);
  stats.byRoute[key] = (stats.byRoute[key] ?? 0) + 1;
  // A latência é aplicada antes de encaminhar: equivale ao RTT de rede até o provedor.
  setTimeout(() => forward(req, res), LATENCY_MS);
});

server.listen(LISTEN_PORT, "127.0.0.1", () => {
  console.log(`proxy de medição em http://127.0.0.1:${LISTEN_PORT} → :${TARGET_PORT} (latência ${LATENCY_MS} ms)`);
});
