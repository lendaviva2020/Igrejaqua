/** Converte "[2027-03-14,2027-03-15)" (canônico do Postgres, fim exclusivo) em datas inclusivas. */
export function parseDateRange(range: string): { from: string; to: string } {
  const m = /^[\[(](\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})[\])]$/.exec(range);
  if (!m) throw new Error(`Intervalo inválido: ${range}`);
  const from = m[1] as string;
  let to = m[2] as string;
  if (range.endsWith(")")) {
    const d = new Date(`${to}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    to = d.toISOString().slice(0, 10);
  }
  return { from, to };
}

