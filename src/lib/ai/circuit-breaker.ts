/** Disjuntor simples: após N falhas seguidas, recusa chamadas por `openMs` (AI_ENGINE §2). */
export interface CircuitBreaker {
  canRequest(): boolean;
  onSuccess(): void;
  onFailure(): void;
}

export function createCircuitBreaker(options: { failureThreshold?: number; openMs?: number; now?: () => number } = {}): CircuitBreaker {
  const threshold = options.failureThreshold ?? 3;
  const openMs = options.openMs ?? 60_000;
  const now = options.now ?? Date.now;
  let failures = 0;
  let openedAt: number | null = null;
  return {
    canRequest(): boolean {
      if (openedAt === null) return true;
      if (now() - openedAt >= openMs) {
        // meia-abertura: permite uma tentativa; nova falha reabre imediatamente
        openedAt = null;
        failures = threshold - 1;
        return true;
      }
      return false;
    },
    onSuccess(): void {
      failures = 0;
      openedAt = null;
    },
    onFailure(): void {
      failures += 1;
      if (failures >= threshold) openedAt = now();
    },
  };
}
