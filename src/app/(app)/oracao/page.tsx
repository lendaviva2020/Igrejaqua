import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { resolveChurchContext } from "@/lib/auth/context";
import { listPrayerRequests } from "@/modules/prayer/queries";
import { getChurchTimezone } from "@/modules/events/queries";
import { PrayerActions } from "./prayer-actions";
import { PrayerForm } from "./prayer-form";

export const metadata: Metadata = { title: "Oração" };

export default async function PrayerPage() {
  const ctx = await resolveChurchContext();
  const [items, tz] = await Promise.all([listPrayerRequests(ctx.churchId, ctx.membershipId), getChurchTimezone(ctx.churchId)]);
  const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: tz });
  const visible = items.filter((i) => i.status === "open" || i.status === "answered");
  return (
    <>
      <PageHeader title="Oração" description="Pedidos compartilhados com a comunidade. Você pode ocultar seu nome." />
      {visible.length === 0 ? <EmptyState title="Nenhum pedido no momento">Seja o primeiro a compartilhar um pedido.</EmptyState> : (
        <ul className="divide-y divide-linha rounded-superficie border border-linha bg-superficie px-4">
          {visible.map((p) => (
            <li key={p.id} className="py-4">
              <p className="whitespace-pre-wrap">{p.body}</p>
              <p className="mt-1 text-sm text-texto-2">
                {p.authorName ?? "Anônimo"} · <time dateTime={p.createdAt}>{fmt.format(new Date(p.createdAt))}</time>{p.status === "answered" ? " · Respondido" : ""}
              </p>
              <PrayerActions requestId={p.id} iPray={p.iPray} count={p.prayingCount} canModerate={p.mine || ctx.role === "admin"} status={p.status} />
            </li>
          ))}
        </ul>
      )}
      <section aria-labelledby="novo" className="mt-10"><h2 id="novo" className="mb-3 text-2xl">Novo pedido</h2><PrayerForm /></section>
    </>
  );
}
