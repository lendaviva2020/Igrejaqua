import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { resolveChurchContext } from "@/lib/auth/context";
import { safeNextPath } from "@/lib/security/safe-redirect";
import { getChurchTimezone } from "@/modules/events/queries";
import { listNotifications } from "@/modules/notifications/queries";
import { MarkAllButton, MarkOneButton } from "./read-buttons";

export const metadata: Metadata = { title: "Notificações" };

export default async function NotificationsPage() {
  const ctx = await resolveChurchContext();
  const [items, tz] = await Promise.all([listNotifications(ctx.churchId), getChurchTimezone(ctx.churchId)]);
  const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz });
  const unread = items.filter((n) => n.read_at === null).length;
  return (
    <>
      <PageHeader title="Notificações" description={unread > 0 ? `${unread} não lida${unread > 1 ? "s" : ""}.` : "Você está em dia."} actions={unread > 0 ? <MarkAllButton /> : undefined} />
      {items.length === 0 ? <EmptyState title="Nenhuma notificação">Avisos de escala e comunicados aparecerão aqui.</EmptyState> : (
        <ul className="flex flex-col gap-3">
          {items.map((n) => (
            <li key={n.id} className={`rounded-superficie border p-4 ${n.read_at === null ? "border-ambar/60 bg-superficie" : "border-linha bg-fundo"}`}>
              <p className="text-xs uppercase tracking-wide text-texto-2">{n.category} · <time dateTime={n.created_at}>{fmt.format(new Date(n.created_at))}</time></p>
              <p className="mt-1 font-semibold">{n.title}</p>
              {n.body ? <p className="text-sm text-texto-2">{n.body}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {n.link_path ? <Link href={safeNextPath(n.link_path)} className="text-sm text-ambar-claro underline">Abrir</Link> : null}
                {n.read_at === null ? <MarkOneButton id={n.id} /> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
