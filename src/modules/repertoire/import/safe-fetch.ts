import "server-only";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { request, type RequestOptions } from "node:https";
import type { IncomingMessage } from "node:http";
import { isIP, type LookupFunction } from "node:net";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import type { Readable } from "node:stream";
import { isPublicAddress } from "./address-guard";

/**
 * Busca de página externa à prova de SSRF para o importador de músicas.
 * - só https na porta 443, sem usuário/senha na URL;
 * - o endereço é validado no `lookup` do socket (momento da conexão): não há janela entre checar e
 *   conectar (DNS rebinding) e redirecionamentos para a rede interna são barrados;
 * - no máximo 3 redirecionamentos, 8 s no total, 1,5 MB descomprimido, apenas text/*.
 */

export type FetchFailure = "invalid-url" | "blocked-address" | "refused" | "timeout" | "too-large" | "unsupported-type" | "http-error" | "too-many-redirects" | "network";

export class PageFetchError extends Error {
  constructor(readonly reason: FetchFailure, detail?: string) {
    super(detail === undefined ? reason : `${reason}: ${detail}`);
    this.name = "PageFetchError";
  }
}

export interface FetchedPage {
  readonly url: string;
  readonly contentType: string;
  readonly body: string;
}

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;
const USER_AGENT = "Mozilla/5.0 (compatible; IGREJAQUA-importador/1.0)";

/** Valida e normaliza a URL informada pela pessoa. */
export function parseImportUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new PageFetchError("invalid-url");
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || (url.port !== "" && url.port !== "443")) throw new PageFetchError("invalid-url");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  // IP literal não passa pelo lookup: valida aqui.
  if (isIP(host) !== 0 && !isPublicAddress(host)) throw new PageFetchError("blocked-address");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".")) throw new PageFetchError("blocked-address");
  url.hash = "";
  return url;
}

/** Resolve o nome e só entrega ao socket endereços públicos (todos precisam ser públicos). */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { all: true, family: options.family ?? 0 }, (err, addresses: LookupAddress[]) => {
    if (err) return callback(err, "", 4);
    if (addresses.length === 0 || addresses.some((a) => !isPublicAddress(a.address))) {
      return callback(new PageFetchError("blocked-address", hostname), "", 4);
    }
    if (options.all === true) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, addresses);
    const first = addresses[0] as LookupAddress;
    return callback(null, first.address, first.family);
  });
};

function decoded(res: IncomingMessage): Readable {
  const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
  if (encoding === "gzip" || encoding === "x-gzip") return res.pipe(createGunzip());
  if (encoding === "deflate") return res.pipe(createInflate());
  if (encoding === "br") return res.pipe(createBrotliDecompress());
  return res;
}

function charsetOf(contentType: string, head: Buffer): string {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head.toString("latin1"))?.[1];
  const label = (fromHeader ?? fromMeta ?? "utf-8").toLowerCase();
  try {
    return new TextDecoder(label).encoding;
  } catch {
    return "utf-8";
  }
}

/** O erro do lookup chega embrulhado pelo socket: preserva o motivo "blocked-address". */
function toFetchError(e: Error): PageFetchError {
  if (e instanceof PageFetchError) return e;
  if (/blocked-address/.test(e.message)) return new PageFetchError("blocked-address");
  return new PageFetchError("network", e.message);
}

function once(url: URL, deadline: number, allowJson: boolean): Promise<{ status: number; location: string | null; contentType: string; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new PageFetchError("timeout"));
    const options: RequestOptions = {
      method: "GET",
      lookup: guardedLookup,
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,text/plain;q=0.9", "accept-encoding": "gzip, deflate, br", "accept-language": "pt-BR,pt;q=0.9" },
      timeout: remaining,
    };
    const req = request(url, options, (res) => {
      const status = res.statusCode ?? 0;
      const location = typeof res.headers.location === "string" ? res.headers.location : null;
      const contentType = String(res.headers["content-type"] ?? "").toLowerCase();
      if (status >= 300 && status < 400) { res.resume(); return resolve({ status, location, contentType, body: Buffer.alloc(0) }); }
      // 401/403/429: o site recusa acesso automatizado (proteção contra robôs). Não tentamos contornar.
      if (status === 401 || status === 403 || status === 429) { res.resume(); return reject(new PageFetchError("refused", String(status))); }
      if (status !== 200) { res.resume(); return reject(new PageFetchError("http-error", String(status))); }
      const accepted = /^(text\/|application\/xhtml\+xml)/.test(contentType) || (allowJson && /^application\/json/.test(contentType));
      if (!accepted && contentType !== "") { res.resume(); return reject(new PageFetchError("unsupported-type", contentType)); }
      const declared = Number(res.headers["content-length"] ?? "0");
      if (declared > MAX_BYTES * 4) { res.resume(); return reject(new PageFetchError("too-large")); }
      const chunks: Buffer[] = [];
      let size = 0;
      const stream = decoded(res);
      stream.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) { req.destroy(); stream.destroy(); reject(new PageFetchError("too-large")); return; }
        chunks.push(chunk);
      });
      stream.on("end", () => resolve({ status, location, contentType, body: Buffer.concat(chunks) }));
      stream.on("error", (e) => reject(new PageFetchError("network", e.message)));
    });
    req.on("timeout", () => { req.destroy(); reject(new PageFetchError("timeout")); });
    req.on("error", (e) => reject(toFetchError(e)));
    req.end();
  });
}

/** Busca a página seguindo redirecionamentos com a mesma validação a cada salto. */
/** `allowJson` só para endpoints de dados conhecidos (ex.: oEmbed do YouTube). */
export async function fetchPublicPage(rawUrl: string, options: { readonly allowJson?: boolean } = {}): Promise<FetchedPage> {
  let url = parseImportUrl(rawUrl);
  const deadline = Date.now() + TIMEOUT_MS;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const r = await once(url, deadline, options.allowJson === true);
    if (r.status >= 300 && r.status < 400) {
      if (r.location === null) throw new PageFetchError("http-error", String(r.status));
      url = parseImportUrl(new URL(r.location, url).toString());
      continue;
    }
    const text = new TextDecoder(charsetOf(r.contentType, r.body.subarray(0, 4096))).decode(r.body);
    return { url: url.toString(), contentType: r.contentType, body: text };
  }
  throw new PageFetchError("too-many-redirects");
}
