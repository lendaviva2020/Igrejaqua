import { createHash, randomBytes } from "node:crypto";
import { publicEnv } from "@/lib/env";

/** 256 bits de entropia, base64url (sem '+', '/' ou '='): seguro em URL. */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Endereço público do link geral da igreja (o token tem 43 caracteres base64url). */
export function joinLinkUrl(token: string): string {
  return `${publicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "")}/entrar/${token}`;
}

/** Mesmo cálculo de `encode(digest(token,'sha256'),'hex')` no accept_invitation. Só o hash vai ao banco. */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
