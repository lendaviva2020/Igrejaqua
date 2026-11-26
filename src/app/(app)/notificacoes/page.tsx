import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { resolveChurchContext } from "@/lib/auth/context";
import { safeNextPath } from "@/lib/security/safe-redirect";
import { getChurchTimezone } from "@/modules/events/queries";
import { parseDeliveryConfig } from "@/lib/notifications/config";
import { getChannelPreferences, listNotifications } from "@/modules/notifications/queries";
import { MarkAllButton, MarkOneButton } from "./read-buttons";
import { PreferenceToggles } from "./preference-toggles";
import { PushToggle } from "./push-toggle";
import type { NotificationChannel } from "@/modules/notifications/preferences";

export const metadata: Metadata = { title: "Notificações" };

export default async function NotificationsPage() {
  const ctx = await resolveChurchContext();
  const [items, tz, prefs] = await Promise.all([listNotifications(ctx.churchId), getChurchTimezone(ctx.churchId), getChannelPreferences(ctx.churchId)]);
  const delivery = parseDeliveryConfig(process.env);
  const channels: NotificationChannel[] = ["in_app", ...(delivery.email ? ["email" as const] : []), ...(delivery.push ? ["push" as const] : [])];
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
      <section aria-labelledby="prefs" className="mt-10">
        <h2 id="prefs" className="mb-1 text-2xl">O que você quer receber</h2>
        <p className="mb-4 text-sm text-texto-2">Escolha por onde receber cada tipo de aviso. O e-mail só é enviado se você ligar.</p>
        {delivery.push ? <div className="mb-4"><PushToggle publicKey={delivery.push.publicKey} /></div> : null}
        <PreferenceToggles initial={prefs} channels={channels} />
      </section>
    </>
  );
}
