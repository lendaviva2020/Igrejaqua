/** Converte "1.234,56", "1234,56" ou "1234.56" em centavos. Retorna null se inválido, zero, negativo ou com mais de 2 casas. */
export function parseMoneyToCents(input: string): number | null {
  const raw = input.trim().replace(/^R\$\s*/i, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$|^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/\.(?=\d{3}(\D|$))/g, "");
  const [whole = "0", fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 100_000_000_000 ? cents : null;
}

export { formatCents } from "@/lib/payments/money";
