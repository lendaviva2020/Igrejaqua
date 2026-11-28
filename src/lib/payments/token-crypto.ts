import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifra dos tokens do Mercado Pago de cada igreja (AES-256-GCM). A chave fica só no servidor
 * (MERCADOPAGO_TOKEN_KEY: 32 bytes em base64); o banco guarda apenas o texto cifrado. Quem tiver uma
 * cópia do banco sem a chave não consegue usar as contas das igrejas.
 *
 * Formato: "v1.<iv>.<tag>.<cifrado>" (base64url).
 */

export class TokenKeyMissingError extends Error {
  constructor() {
    super("MERCADOPAGO_TOKEN_KEY ausente ou inválida (32 bytes em base64).");
    this.name = "TokenKeyMissingError";
  }
}

export function loadTokenKey(env: Readonly<Record<string, string | undefined>> = process.env): Buffer {
  const raw = env["MERCADOPAGO_TOKEN_KEY"];
  if (raw === undefined || raw.trim() === "") throw new TokenKeyMissingError();
  const key = Buffer.from(raw.trim(), "base64");
  if (key.length !== 32) throw new TokenKeyMissingError();
  return key;
}

export function encryptToken(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function decryptToken(sealed: string, key: Buffer): string {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== "v1" || iv === undefined || tag === undefined || data === undefined) throw new Error("Token cifrado em formato desconhecido.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
