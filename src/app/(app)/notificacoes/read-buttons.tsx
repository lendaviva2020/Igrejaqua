"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/modules/notifications/actions";

export function MarkAllButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <Button type="button" variant="secondary" disabled={pending} onClick={() => start(async () => { await markAllNotificationsReadAction(); router.refresh(); })}>Marcar todas como lidas</Button>;
}

export function MarkOneButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <Button type="button" variant="quiet" disabled={pending} onClick={() => start(async () => { await markNotificationReadAction({ id }); router.refresh(); })}>Marcar como lida</Button>;
}
