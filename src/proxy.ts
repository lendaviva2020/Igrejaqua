import { NextResponse, type NextRequest } from "next/server";
import { classifyPath } from "@/lib/seo/routes";
import { updateSession } from "@/lib/supabase/proxy-session";

/** Recursos que nunca dependem da sessão: não pagam a ida ao servidor Auth a cada requisição. */
const SESSIONLESS_PREFIXES = ["/robots.txt", "/sitemap.xml", "/manifest.json", "/api/vitals", "/api/webhooks/", "/api/cron/"] as const;
const NOINDEX = "noindex, nofollow";

function buildCsp(nonce: string): string {
  const dev = process.env.NODE_ENV !== "production";
  const supabase = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabase}`.trim(),
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);

  const { pathname } = request.nextUrl;
  const access = classifyPath(pathname);
  const response = NextResponse.next({ request: { headers } });
  const sessionless = SESSIONLESS_PREFIXES.some((p) => pathname.startsWith(p));
  const { userId } = sessionless ? { userId: null } : await updateSession(request, response);

  if (access === "protected" && userId === null) {
    const redirect = NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname + request.nextUrl.search)}`, request.url));
    redirect.headers.set("content-security-policy", csp);
    redirect.headers.set("x-robots-tag", NOINDEX);
    return redirect;
  }
  response.headers.set("content-security-policy", csp);
  // Só as páginas institucionais são indexáveis; o resto recebe noindex também no cabeçalho
  // (cobre rotas de API, arquivos e respostas que não carregam a meta tag).
  if (access !== "indexable") response.headers.set("x-robots-tag", NOINDEX);
  // Caminho inexistente segue para o Next.js e recebe 404 real; nunca é guardado em cache compartilhado.
  if (access === "protected" || access === "unknown") response.headers.set("cache-control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)"],
};
