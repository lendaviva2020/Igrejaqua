/**
 * Chave Pix da igreja e Pix "copia e cola" (BR Code) no padrão do Banco Central (Manual de Padrões para
 * Iniciação do Pix — EMV® QRCPS-MPM). Funções puras: rodam no servidor e nos testes.
 *
 * O dinheiro vai direto da conta do membro para a conta da igreja: o IGREJAQUA só monta o código.
 */

export const PIX_KEY_TYPES = ["cnpj", "cpf", "email", "phone", "random"] as const;
export type PixKeyType = (typeof PIX_KEY_TYPES)[number];

export const PIX_KEY_TYPE_LABEL: Readonly<Record<PixKeyType, string>> = {
  cnpj: "CNPJ", cpf: "CPF", email: "E-mail", phone: "Celular", random: "Chave aleatória",
};

const onlyDigits = (v: string): string => v.replace(/\D/g, "");

function validCpf(d: string): boolean {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number): number => {
    let sum = 0;
    for (let i = 0; i < len; i += 1) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

function validCnpj(d: string): boolean {
  if (!/^\d{14}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len: number): number => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i += 1) sum += Number(d[i]) * (weights[i] ?? 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

export type PixKeyResult = { readonly ok: true; readonly key: string } | { readonly ok: false; readonly message: string };

/** Valida e normaliza a chave no formato que o Pix usa (só dígitos, +55…, minúsculas). */
export function normalizePixKey(type: PixKeyType, raw: string): PixKeyResult {
  const value = raw.trim();
  switch (type) {
    case "cnpj": {
      const d = onlyDigits(value);
      return validCnpj(d) ? { ok: true, key: d } : { ok: false, message: "CNPJ inválido. Confira os 14 números." };
    }
    case "cpf": {
      const d = onlyDigits(value);
      return validCpf(d) ? { ok: true, key: d } : { ok: false, message: "CPF inválido. Confira os 11 números." };
    }
    case "email": {
      const e = value.toLowerCase();
      return e.length <= 77 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? { ok: true, key: e } : { ok: false, message: "E-mail inválido." };
    }
    case "phone": {
      let d = onlyDigits(value);
      if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
      return /^\d{10,11}$/.test(d) ? { ok: true, key: `+55${d}` } : { ok: false, message: "Celular inválido. Use DDD + número, ex.: (11) 99999-9999." };
    }
    case "random": {
      const r = value.toLowerCase();
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(r) ? { ok: true, key: r } : { ok: false, message: "Chave aleatória inválida (formato 0000aaaa-00aa-…)." };
    }
  }
}

/** Mostra a chave sem expor documento inteiro (CPF/CNPJ). */
export function maskPixKey(type: PixKeyType, key: string): string {
  if (type === "cpf") return `***.${key.slice(3, 6)}.${key.slice(6, 9)}-**`;
  if (type === "cnpj") return `${key.slice(0, 2)}.${key.slice(2, 5)}.${key.slice(5, 8)}/${key.slice(8, 12)}-${key.slice(12)}`;
  return key;
}

/** Texto do recebedor no BR Code: sem acento, só caracteres seguros, no limite de tamanho. */
export function sanitizeMerchantText(value: string, max: number): string {
  return value
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .,&/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

/** CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF), exigido no campo 63 do BR Code. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b += 1) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function field(id: string, value: string): string {
  if (value.length > 99) throw new Error(`Campo ${id} do Pix longo demais`);
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

export interface BrCodeInput {
  readonly key: string;            // chave normalizada
  readonly recipientName: string;  // ≤ 25
  readonly recipientCity: string;  // ≤ 15
  readonly amountCents?: number;   // sem valor = o pagador digita
  readonly txid?: string;          // A-Z a-z 0-9, ≤ 25; "***" quando ausente
  readonly description?: string;   // aparece em alguns bancos
}

/** Monta o Pix "copia e cola" (o mesmo texto vira o QR Code). */
export function buildPixBrCode(input: BrCodeInput): string {
  const name = sanitizeMerchantText(input.recipientName, 25);
  const city = sanitizeMerchantText(input.recipientCity, 15);
  if (name === "" || city === "") throw new Error("Nome e cidade do recebedor são obrigatórios");
  const txid = input.txid ?? "***";
  if (!/^(\*\*\*|[A-Za-z0-9]{1,25})$/.test(txid)) throw new Error("Identificador do Pix inválido");
  const description = input.description === undefined ? "" : sanitizeMerchantText(input.description, 40);
  const account = field("00", "br.gov.bcb.pix") + field("01", input.key) + (description !== "" ? field("02", description) : "");
  const amount = input.amountCents === undefined ? "" : field("54", (input.amountCents / 100).toFixed(2));
  const payload =
    field("00", "01") +
    field("26", account) +
    field("52", "0000") +
    field("53", "986") +
    amount +
    field("58", "BR") +
    field("59", name) +
    field("60", city) +
    field("62", field("05", txid)) +
    "6304";
  return payload + crc16(payload);
}

/** Identificador do Pix derivado da contribuição (25 caracteres alfanuméricos, único). */
export function txidFromChargeId(chargeId: string): string {
  return `IQ${chargeId.replace(/-/g, "").slice(0, 23).toUpperCase()}`;
}
