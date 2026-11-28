import { z } from "zod";

/** Métricas aceitas: Core Web Vitals + métricas de navegação do Next.js. */
export const WEB_VITAL_NAMES = ["CLS", "FCP", "INP", "LCP", "TTFB", "Next.js-hydration", "Next.js-route-change-to-render", "Next.js-render"] as const;

export const webVitalSchema = z
  .object({
    name: z.enum(WEB_VITAL_NAMES),
    value: z.number().finite().min(0).max(600_000),
    rating: z.enum(["good", "needs-improvement", "poor"]).optional(),
    navigationType: z.string().regex(/^[a-z-]{1,24}$/).optional(),
    route: z.string().max(80).regex(/^\/[a-z0-9\-/:]*$/),
  })
  .strict();
export type WebVitalReport = z.infer<typeof webVitalSchema>;

/**
 * Reduz o caminho ao padrão da rota: mantém só o primeiro segmento e troca os demais por ":param".
 * Ids, códigos de convite e outros parâmetros nunca saem do navegador (LGPD / SECURITY).
 */
export function normalizeRoute(pathname: string): string {
  const segments = pathname.split("/").filter((s) => s !== "");
  const first = segments[0];
  if (first === undefined) return "/";
  const safeFirst = /^[a-z0-9-]{1,40}$/.test(first) ? first : ":param";
  return `/${[safeFirst, ...segments.slice(1).map(() => ":param")].join("/")}`;
}
