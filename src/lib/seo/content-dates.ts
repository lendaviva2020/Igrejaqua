/**
 * Datas reais de última revisão das páginas institucionais. Fonte única: a página exibe a data e o
 * sitemap publica o mesmo valor em <lastmod>. Atualize junto com o texto; nunca use a data do build.
 * A home não tem data editorial confiável, por isso não declara lastmod.
 */
export const LEGAL_UPDATED_AT = {
  privacidade: "2026-11-27",
  termos: "2026-11-26",
} as const satisfies Record<string, `${number}-${number}-${number}`>;

const LONG_DATE = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** "2026-11-26" → "26 de novembro de 2026". */
export function formatLegalDate(isoDate: string): string {
  return LONG_DATE.format(new Date(`${isoDate}T00:00:00Z`));
}
