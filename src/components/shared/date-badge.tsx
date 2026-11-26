const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: "UTC" });
const wk = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });
const mon = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });

/** Bloco de data (Sáb / 24 / mai). Recebe o instante e o fuso da igreja para não errar o dia. */
export function DateBadge({ iso, timeZone }: { iso: string; timeZone: string }) {
  // Desloca o instante para o "relógio de parede" do fuso e lê em UTC.
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const wall = new Date(`${parts}T12:00:00Z`);
  return (
    <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-controle bg-superficie-2 text-center leading-none" aria-hidden="true">
      <span className="text-[0.65rem] uppercase tracking-wide text-texto-2">{wk.format(wall).replace(".", "")}</span>
      <span className="tabular my-0.5 text-xl font-bold text-ambar">{day.format(wall)}</span>
      <span className="text-[0.65rem] uppercase tracking-wide text-texto-2">{mon.format(wall).replace(".", "")}</span>
    </div>
  );
}
