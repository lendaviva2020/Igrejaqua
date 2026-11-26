import "server-only";
import { NextResponse } from "next/server";
import type { ErrorCode, Result } from "@/lib/result";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, VALIDATION: 422, CONFLICT: 409,
  RULE_VIOLATION: 422, RATE_LIMITED: 429, AI_UNAVAILABLE: 503, UNAVAILABLE: 503, INTERNAL: 500,
};
const NO_STORE = { "cache-control": "no-store" } as const;

export function jsonResult<T>(result: Result<T>): NextResponse {
  if (result.ok) return NextResponse.json(result.data, { status: 200, headers: NO_STORE });
  return NextResponse.json({ error: result.error }, { status: STATUS[result.error.code], headers: NO_STORE });
}

/** Rejeita requisições que um formulário de outro site poderia forjar (defesa em profundidade além de SameSite). */
export function isJsonRequest(request: Request): boolean {
  return (request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json");
}
