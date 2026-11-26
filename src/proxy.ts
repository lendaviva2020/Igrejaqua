import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy-session";

const PUBLIC_PREFIXES = ["/login", "/cadastro", "/recuperar-senha", "/callback", "/manifest.json", "/icons", "/images", "/api/webhooks/"];

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
  const response = NextResponse.next({ request: { headers } });
  const { userId } = await updateSession(request, response);

  const isPublic = pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  if (userId === null && !isPublic) {
    const redirect = NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname + request.nextUrl.search)}`, request.url));
    redirect.headers.set("content-security-policy", csp);
    return redirect;
  }
  response.headers.set("content-security-policy", csp);
  if (!isPublic) response.headers.set("cache-control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)"],
};
