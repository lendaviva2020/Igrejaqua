"use client";

import { useEffect, useState, useTransition } from "react";
import { removePushSubscriptionAction, savePushSubscriptionAction } from "@/modules/notifications/actions";

type PushState = "checking" | "unsupported" | "denied" | "off" | "on";

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=").replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function toBase64Url(buffer: ArrayBuffer | null): string {
  if (buffer === null) return "";
  let binary = "";
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Ativa/desativa o push só neste aparelho. A chave pública VAPID vem do servidor. */
export function PushToggle({ publicKey }: { readonly publicKey: string }) {
  const [state, setState] = useState<PushState>("checking");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let active = true;
    const detect = async (): Promise<PushState> => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
      if (Notification.permission === "denied") return "denied";
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      return subscription ? "on" : "off";
    };
    detect().then((next) => { if (active) setState(next); }, () => { if (active) setState("unsupported"); });
    return () => { active = false; };
  }, []);

  const enable = () => {
    setError(null);
    start(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") { setState(permission === "denied" ? "denied" : "off"); return; }
        const registration = await navigator.serviceWorker.ready;
        const subscription = (await registration.pushManager.getSubscription()) ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) }));
        const result = await savePushSubscriptionAction({ endpoint: subscription.endpoint, p256dh: toBase64Url(subscription.getKey("p256dh")), auth: toBase64Url(subscription.getKey("auth")) });
        if (!result.ok) { await subscription.unsubscribe(); setError(result.error.message); return; }
        setState("on");
      } catch {
        setError("Não foi possível ativar as notificações neste aparelho.");
      }
    });
  };

  const disable = () => {
    setError(null);
    start(async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          const result = await removePushSubscriptionAction({ endpoint: subscription.endpoint });
          if (!result.ok) { setError(result.error.message); return; }
          await subscription.unsubscribe();
        }
        setState("off");
      } catch {
        setError("Não foi possível desativar as notificações neste aparelho.");
      }
    });
  };

  const message: Record<PushState, string> = {
    checking: "Verificando este aparelho…",
    unsupported: "Este navegador não oferece notificações no celular. No iPhone, instale o app na tela de início primeiro.",
    denied: "As notificações estão bloqueadas neste navegador. Libere nas configurações do navegador para ativar.",
    off: "Receba avisos de escala e comunicados mesmo com o app fechado.",
    on: "Ativas neste aparelho.",
  };
  return (
    <div className="rounded-superficie border border-linha bg-superficie p-4">
      <p className="font-medium">Notificações neste aparelho</p>
      <p className="mt-1 text-sm text-texto-2">{message[state]}</p>
      {state === "off" ? <button type="button" onClick={enable} disabled={pending} className="mt-3 min-h-11 rounded-full bg-ambar px-5 font-semibold text-fundo disabled:opacity-60">Ativar neste aparelho</button> : null}
      {state === "on" ? <button type="button" onClick={disable} disabled={pending} className="mt-3 min-h-11 rounded-full border border-linha px-5 font-semibold disabled:opacity-60">Desativar neste aparelho</button> : null}
      {error ? <p role="alert" className="mt-2 text-sm text-perigo">{error}</p> : null}
    </div>
  );
}
