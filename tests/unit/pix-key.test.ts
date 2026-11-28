import { describe, expect, it } from "vitest";
import { buildPixBrCode, crc16, maskPixKey, normalizePixKey, sanitizeMerchantText, txidFromChargeId } from "@/lib/payments/pix-key";

describe("chave Pix da igreja", () => {
  it("valida CNPJ e CPF pelos dígitos verificadores e normaliza para só números", () => {
    expect(normalizePixKey("cnpj", "11.222.333/0001-81")).toEqual({ ok: true, key: "11222333000181" });
    expect(normalizePixKey("cnpj", "11.222.333/0001-82").ok).toBe(false);
    expect(normalizePixKey("cnpj", "00.000.000/0000-00").ok).toBe(false);
    expect(normalizePixKey("cpf", "529.982.247-25")).toEqual({ ok: true, key: "52998224725" });
    expect(normalizePixKey("cpf", "111.111.111-11").ok).toBe(false);
  });
  it("e-mail em minúsculas, celular com +55 e chave aleatória", () => {
    expect(normalizePixKey("email", " Tesouraria@Igreja.ORG ")).toEqual({ ok: true, key: "tesouraria@igreja.org" });
    expect(normalizePixKey("phone", "(11) 99999-8888")).toEqual({ ok: true, key: "+5511999998888" });
    expect(normalizePixKey("phone", "+55 11 99999-8888")).toEqual({ ok: true, key: "+5511999998888" });
    expect(normalizePixKey("phone", "9999").ok).toBe(false);
    expect(normalizePixKey("random", "123E4567-E12B-12D1-A456-426655440000")).toEqual({ ok: true, key: "123e4567-e12b-12d1-a456-426655440000" });
    expect(normalizePixKey("random", "nao-e-chave").ok).toBe(false);
  });
  it("mascara CPF ao exibir", () => {
    expect(maskPixKey("cpf", "52998224725")).toBe("***.982.247-**");
  });
});

describe("Pix copia e cola (BR Code)", () => {
  it("reproduz o exemplo oficial do Banco Central, inclusive o CRC", () => {
    // Manual de Padrões para Iniciação do Pix (BCB), exemplo de QR estático.
    const official = "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D";
    expect(crc16(official.slice(0, -4))).toBe("1D3D");
    expect(buildPixBrCode({ key: "123e4567-e12b-12d1-a456-426655440000", recipientName: "Fulano de Tal", recipientCity: "BRASILIA" })).toBe(official);
  });
  it("com valor, identificador e nome com acento (removido)", () => {
    const code = buildPixBrCode({ key: "tesouraria@igreja.org", recipientName: "Igreja Comunhão é Vida da Cidade", recipientCity: "São Paulo", amountCents: 5050, txid: "IQABC123", description: "Oferta" });
    expect(code).toContain("540550.50");
    expect(code).toContain("5925Igreja Comunhao e Vida da");
    expect(code).toContain("6009Sao Paulo");
    expect(code).toContain("62120508IQABC123");
    expect(code).toContain("0206Oferta");
    expect(crc16(code.slice(0, -4))).toBe(code.slice(-4));
    expect(code).not.toMatch(/[ãéç]/);
  });
  it("identificador da contribuição tem 25 caracteres alfanuméricos", () => {
    const txid = txidFromChargeId("3f2504e0-4f89-41d3-9a0c-0305e82c3301");
    expect(txid).toMatch(/^[A-Z0-9]{25}$/);
    expect(txid.startsWith("IQ")).toBe(true);
  });
  it("limpa caracteres que quebrariam o código", () => {
    expect(sanitizeMerchantText("Igreja <script> \"x\"", 25)).toBe("Igreja script x");
  });
});
