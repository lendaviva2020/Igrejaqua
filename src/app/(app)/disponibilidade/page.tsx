import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { resolveChurchContext } from "@/lib/auth/context";
import { WEEKDAY_LABELS } from "@/modules/availability/schemas";
import { listMyUnavailabilities } from "@/modules/availability/queries";
import { AvailabilityForm, RemoveUnavailabilityButton } from "./availability-form";

export const metadata: Metadata = { title: "Disponibilidade" };
const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const fmt = (d: string): string => dateFmt.format(new Date(`${d}T00:00:00Z`));

export default async function AvailabilityPage() {
  const ctx = await resolveChurchContext();
  const items = await listMyUnavailabilities(ctx.churchId);
  return (
    <>
      <PageHeader title="Disponibilidade" description="Avise os líderes quando não puder ser escalado. O motivo é privado." />
      {items.length === 0 ? <EmptyState title="Nenhuma indisponibilidade registrada">Você está disponível para todas as escalas.</EmptyState> : (
        <ul className="divide-y divide-linha border-y border-linha">
          {items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium">{i.from === i.to ? fmt(i.from) : `${fmt(i.from)} a ${fmt(i.to)}`}{i.weekdays ? ` · ${i.weekdays.map((d) => WEEKDAY_LABELS[d]).join(", ")}` : ""}</p>
                {i.reason ? <p className="text-sm text-tinta-2">{i.reason}</p> : null}
              </div>
              <RemoveUnavailabilityButton id={i.id} />
            </li>
          ))}
        </ul>
      )}
      <section aria-labelledby="nova" className="mt-10"><h2 id="nova" className="mb-3 text-2xl">Nova indisponibilidade</h2><AvailabilityForm /></section>
    </>
  );
}
