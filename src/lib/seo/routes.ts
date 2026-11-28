import { resolveAppBaseUrl } from "@/lib/app-url";

/**
 * Classificação única das rotas do IGREJAQUA para autenticação (src/proxy.ts) e indexação (sitemap,
 * robots, X-Robots-Tag). Um teste (tests/unit/seo-routes.test.ts) percorre src/app e falha se uma rota
 * nova não estiver classificada aqui — assim nenhuma área privada fica sem guarda por esquecimento.
 */

/** Páginas públicas que devem aparecer na busca. Fonte do sitemap e das canônicas. */
export const INDEXABLE_PATHS = ["/", "/privacidade", "/termos"] as const;
export type IndexablePath = (typeof INDEXABLE_PATHS)[number];

/**
 * Rotas acessíveis sem sessão, mas que não devem ser indexadas (autenticação, recursos técnicos).
 * Prefixos terminados em "/" casam com subcaminhos; os demais casam com o caminho exato ou "<prefixo>/…".
 */
export const PUBLIC_NOINDEX_PREFIXES = [
  "/login",
  "/cadastro",
  "/recuperar-senha",
  "/callback",
  "/offline",
  "/manifest.json",
  "/robots.txt",
  "/sitemap.xml",
  "/icons",
  "/brand",
  "/api/webhooks/",
  "/api/cron/",
  "/api/vitals",
] as const;

/**
 * Áreas que exigem sessão. O proxy redireciona para o login; os layouts e as rotas de API validam de
 * novo no servidor (getUser) e a RLS é a barreira final. Qualquer caminho fora das três listas não
 * existe: segue para o Next.js e recebe 404 real (sem redirecionar para o login nem para a home).
 */
export const PROTECTED_PREFIXES = [
  // (app)
  "/dashboard", "/agenda", "/biblia", "/celulas", "/comunicados", "/configuracoes", "/contribuir",
  "/disponibilidade", "/familias", "/financeiro", "/membros", "/ministerios", "/notificacoes",
  "/oracao", "/repertorio", "/visitantes",
  // (auth) que dependem de sessão
  "/mfa", "/redefinir-senha",
  // (onboarding) e (stage)
  "/entrar", "/selecionar-igreja", "/palco",
  // APIs autenticadas
  "/api/ai/", "/api/me/",
] as const;

export type RouteAccess = "indexable" | "public-noindex" | "protected" | "unknown";

function matchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix.endsWith("/")) return pathname.startsWith(prefix);
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Classifica um caminho (sem query string). A ordem importa: protegido vence qualquer outra regra. */
export function classifyPath(pathname: string): RouteAccess {
  if (PROTECTED_PREFIXES.some((p) => matchesPrefix(pathname, p))) return "protected";
  if ((INDEXABLE_PATHS as readonly string[]).includes(pathname)) return "indexable";
  if (PUBLIC_NOINDEX_PREFIXES.some((p) => matchesPrefix(pathname, p))) return "public-noindex";
  return "unknown";
}

const DEFAULT_ORIGIN = "http://localhost:3000";

/**
 * Origem canônica absoluta (sem barra final) para SEO: sempre o domínio de PRODUÇÃO, mesmo num
 * deploy de preview (canônica não aponta para URLs temporárias). Mesmas regras de src/lib/app-url.ts:
 * variável explícita válida (localhost só vale em desenvolvimento local) → domínio de produção da
 * Vercel → localhost.
 */
export function siteOrigin(env: Readonly<Record<string, string | undefined>> = process.env): string {
  const production = env["VERCEL_PROJECT_PRODUCTION_URL"];
  const canonicalEnv = { ...env, VERCEL_ENV: production !== undefined && production !== "" ? "production" : undefined, VERCEL_URL: undefined, VERCEL_BRANCH_URL: undefined };
  return resolveAppBaseUrl(canonicalEnv) ?? DEFAULT_ORIGIN;
}

/** URL absoluta para um caminho do site. */
export function absoluteUrl(path: string, env?: Readonly<Record<string, string | undefined>>): string {
  return new URL(path, `${siteOrigin(env)}/`).toString();
}
