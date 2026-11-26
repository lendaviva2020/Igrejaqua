/** Conversão de "data/hora de parede" (como digitada em <input type="datetime-local">) para o instante UTC, num fuso IANA. */

function offsetMs(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(instantMs));
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? "NaN");
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Retorna null para formato inválido, data inexistente (ex.: 31/02) ou fuso desconhecido. */
export function zonedLocalToUtc(local: string, timeZone: string): Date | null {
  const m = LOCAL.exec(local);
  if (m === null) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(naive);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || check.getUTCHours() !== h) return null;
  try {
    const first = naive - offsetMs(naive, timeZone);
    const second = naive - offsetMs(first, timeZone); // reavalia o deslocamento na fronteira de horário de verão
    return new Date(second);
  } catch {
    return null;
  }
}
