/**
 * Pseudonimização efêmera para envio à DeepSeek (AI_ENGINE §6).
 * O mapa token→id existe só em memória durante a execução; nunca é persistido nem enviado.
 */
export interface Pseudonymizer {
  /** "M01" para uma pessoa; cria sob demanda. */
  tokenFor(realId: string): string;
  /** id real ou null se o token não pertence a esta execução (alucinação). */
  resolve(token: string): string | null;
  readonly size: number;
}

export function createPseudonymizer(prefix = "M"): Pseudonymizer {
  const forward = new Map<string, string>();
  const backward = new Map<string, string>();
  return {
    tokenFor(realId: string): string {
      const existing = forward.get(realId);
      if (existing !== undefined) return existing;
      const token = `${prefix}${String(forward.size + 1).padStart(2, "0")}`;
      forward.set(realId, token);
      backward.set(token, realId);
      return token;
    },
    resolve(token: string): string | null {
      return backward.get(token) ?? null;
    },
    get size(): number {
      return forward.size;
    },
  };
}
