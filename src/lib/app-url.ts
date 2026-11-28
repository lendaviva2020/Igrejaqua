/**
 * URL base pública do app para links que saem do sistema: convites, link da igreja, e-mails de
 * confirmação/recuperação, retorno do login com Google, webhook do Pix e notificações.
 *
 * Causa do bug que este módulo corrige: os links usavam NEXT_PUBLIC_SITE_URL com padrão
 * "http://localhost:3000"; como a variável não existia na Vercel, produção gerava links de localhost.
 *
 * Ordem de prioridade (a primeira válida vence):
 *  1. NEXT_PUBLIC_APP_URL ou NEXT_PUBLIC_SITE_URL explícitas (ignoradas se apontarem para
 *     localhost rodando na Vercel — configuração errada não vaza para links públicos);
 *  2. Vercel: produção → VERCEL_PROJECT_PRODUCTION_URL; preview → VERCEL_BRANCH_URL / VERCEL_URL (https);
 *  3. cabeçalhos da requisição (x-forwarded-host/proto ou host) — servidor fora da Vercel;
 *  4. desenvolvimento local (NODE_ENV=development) → http://localhost:3000.
 * Sem nenhuma delas em produção: null (quem chama recusa gerar o link, em vez de gerar um quebrado).
 */

export type Env = Readonly<Record<string, string | undefined>>;

export interface RequestHostHints {
  readonly forwardedHost?: string | null;
  readonly forwardedProto?: string | null;
  readonly host?: string | null;
}

const LOCAL_HOST = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\]|0\.0\.0\.0)(:\d+)?$/i;
/** Nome de host válido (com porta opcional); bloqueia caminhos, credenciais e caracteres de injeção. */
const HOST_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?::\d{1,5})?$|^(localhost|127(?:\.\d{1,3}){3})(?::\d{1,5})?$/i;

function isLocal(host: string): boolean {
  return LOCAL_HOST.test(host);
}

/** Rodando na Vercel (preview ou produção): links precisam ser públicos, nunca localhost. */
function isOnVercel(env: Env): boolean {
  return env["VERCEL"] === "1" || (env["VERCEL_ENV"] !== undefined && env["VERCEL_ENV"] !== "");
}

function first(value: string | null | undefined): string | null {
  const v = value?.split(",")[0]?.trim() ?? "";
  return v === "" ? null : v;
}

/** Normaliza para "protocolo://host[:porta]" sem barra final; null se inválido. */
function originOf(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username !== "" || url.password !== "") return null;
    return url;
  } catch {
    return null;
  }
}

function fromHost(host: string | null, protocol: "https" | "http"): string | null {
  if (host === null || !HOST_PATTERN.test(host)) return null;
  return `${protocol}://${host.toLowerCase()}`;
}

/** Resolve a URL base (sem barra final). Função pura: recebe ambiente e dicas da requisição. */
export function resolveAppBaseUrl(env: Env, hints: RequestHostHints = {}): string | null {
  const onVercel = isOnVercel(env);

  // 1. Variável explícita.
  for (const name of ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SITE_URL"] as const) {
    const raw = env[name];
    if (raw === undefined || raw.trim() === "") continue;
    const url = originOf(raw);
    if (url === null) continue;
    if (isLocal(url.host) && onVercel) continue; // localhost esquecido na configuração da Vercel: ignora.
    if (url.protocol === "http:" && !isLocal(url.host)) continue; // domínio público só com https.
    return url.origin;
  }

  // 2. Vercel.
  const vercelEnv = env["VERCEL_ENV"];
  if (vercelEnv === "production") {
    const prod = fromHost(first(env["VERCEL_PROJECT_PRODUCTION_URL"]), "https");
    if (prod !== null) return prod;
  }
  if (vercelEnv === "preview" || vercelEnv === "development" || vercelEnv === "production") {
    const deployment = fromHost(first(env["VERCEL_BRANCH_URL"]), "https") ?? fromHost(first(env["VERCEL_URL"]), "https");
    if (deployment !== null) return deployment;
  }

  // 3. Cabeçalhos da requisição (servidor próprio, fora da Vercel).
  const host = first(hints.forwardedHost) ?? first(hints.host);
  if (host !== null && HOST_PATTERN.test(host)) {
    if (isLocal(host)) {
      if (!onVercel) return fromHost(host, first(hints.forwardedProto) === "https" ? "https" : "http");
    } else {
      // Domínio público: sempre https, mesmo que o proxy informe http.
      return fromHost(host, "https");
    }
  }

  // 4. Desenvolvimento local.
  if (env["NODE_ENV"] === "development" && !onVercel) return "http://localhost:3000";
  return null;
}

export class AppUrlNotConfiguredError extends Error {
  constructor() {
    super("URL pública do app não configurada: defina NEXT_PUBLIC_SITE_URL (ex.: https://igrejaqua.vercel.app).");
    this.name = "AppUrlNotConfiguredError";
  }
}

/** Junta a base com um caminho interno ("/entrar/x"), garantindo uma única barra. */
export function joinAppUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
