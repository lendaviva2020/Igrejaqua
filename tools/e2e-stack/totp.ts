import { createHmac, randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of input.replace(/=+$/, "").toUpperCase()) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("base32 inválido");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** TOTP RFC 6238 (SHA-1, 6 dígitos, passo de 30 s). */
export function totpCode(secret: string, atMs: number = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(atMs / 30_000)));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 15;
  const binary = (((hmac[offset] ?? 0) & 127) << 24) | ((hmac[offset + 1] ?? 0) << 16) | ((hmac[offset + 2] ?? 0) << 8) | (hmac[offset + 3] ?? 0);
  return String(binary % 1_000_000).padStart(6, "0");
}

/** Aceita o passo atual e os vizinhos (tolerância de relógio de ±30 s). */
export function verifyTotp(secret: string, code: string, atMs: number = Date.now()): boolean {
  return [-1, 0, 1].some((step) => totpCode(secret, atMs + step * 30_000) === code);
}
