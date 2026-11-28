import { createHash, randomBytes } from "node:crypto";
import { joinAppUrl } from "@/lib/app-url";

/** 256 bits de entropia, base64url (sem '+', '/' ou '='): seguro em URL. */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Endereço público do link geral da igreja (o token tem 43 caracteres base64url). `base` vem de getAppBaseUrl(). */
export function joinLinkUrl(base: string, token: string): string {
  return joinAppUrl(base, `/entrar/${token}`);
}

/** Endereço do convite individual (uso único, 7 dias, só para o e-mail convidado). */
export function invitationUrl(base: string, token: string): string {
  return joinAppUrl(base, `/selecionar-igreja?convite=${token}`);
}

/** Mesmo cálculo de `encode(digest(token,'sha256'),'hex')` no accept_invitation. Só o hash vai ao banco. */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
