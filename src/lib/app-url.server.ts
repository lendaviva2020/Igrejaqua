import "server-only";
import { headers } from "next/headers";
import { AppUrlNotConfiguredError, joinAppUrl, resolveAppBaseUrl } from "./app-url";

/**
 * URL base do app para a requisição atual (Server Components, Server Actions e Route Handlers).
 * Lança AppUrlNotConfiguredError se não houver como resolver (produção sem variável nem Vercel):
 * melhor recusar do que entregar um link quebrado.
 */
export async function getAppBaseUrl(): Promise<string> {
  let hints = {};
  try {
    const h = await headers();
    hints = { forwardedHost: h.get("x-forwarded-host"), forwardedProto: h.get("x-forwarded-proto"), host: h.get("host") };
  } catch {
    // Fora de requisição (ex.: job agendado): resolve só pelo ambiente.
  }
  const base = resolveAppBaseUrl(process.env, hints);
  if (base === null) throw new AppUrlNotConfiguredError();
  return base;
}

/** URL absoluta para um caminho interno do app. */
export async function appUrl(path: string): Promise<string> {
  return joinAppUrl(await getAppBaseUrl(), path);
}

/** Como appUrl, mas devolve null (e registra) quando a URL pública não está configurada. */
export async function appUrlOrNull(path: string): Promise<string | null> {
  try {
    return await appUrl(path);
  } catch (e) {
    if (e instanceof AppUrlNotConfiguredError) { console.error("app_url_not_configured"); return null; }
    throw e;
  }
}
