import { BlockList, isIP } from "node:net";

/**
 * Endereços que o importador nunca pode acessar (SSRF): rede local, loopback, metadados de nuvem
 * (169.254.169.254), faixas reservadas, multicast e documentação. Só sobra internet pública.
 */
const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["100::", 64],
  ["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) blocked.addSubnet(net, prefix, "ipv6");

/**
 * IPv4 embutido em IPv6 (::ffff:10.0.0.1) é avaliado como IPv4. (Não adicionar ::ffff:0:0/96 à lista:
 * o BlockList do Node trata todo IPv4 como mapeado e bloquearia a internet inteira.)
 */
function unwrapMapped(address: string): string {
  const m = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address);
  return m?.[1] ?? address;
}

/** true só para endereço IP público e roteável. Qualquer coisa que não seja IP válido é recusada. */
export function isPublicAddress(address: string): boolean {
  const ip = unwrapMapped(address.trim());
  const family = isIP(ip);
  if (family === 4) return !blocked.check(ip, "ipv4");
  if (family === 6) {
    // Só unicast global (2000::/3) é aceito em IPv6.
    if (!/^[23][0-9a-f]{0,3}:/i.test(ip)) return false;
    return !blocked.check(ip, "ipv6");
  }
  return false;
}
