/** "50", "50,5", "1.250,00" -> centavos inteiros; null se inválido. Sem ponto flutuante. */
export function parseBrlToCents(input: string): number | null {
  const cleaned = input.trim().replace(/^R\$\s*/i, "").replace(/\./g, "").replace(",", ".");
  const m = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!m) return null;
  const reais = Number(m[1]);
  const cents = m[2] === undefined ? 0 : Number(m[2].padEnd(2, "0"));
  return reais * 100 + cents;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatCents(cents: number): string {
  return brl.format(cents / 100);
}
