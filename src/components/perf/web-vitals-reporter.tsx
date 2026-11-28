"use client";

import { useReportWebVitals } from "next/web-vitals";
import { normalizeRoute, WEB_VITAL_NAMES, type WebVitalReport } from "@/lib/perf/web-vitals";

const ENDPOINT = "/api/vitals";
const ACCEPTED: ReadonlySet<string> = new Set(WEB_VITAL_NAMES);

type ReportedMetric = Parameters<Parameters<typeof useReportWebVitals>[0]>[0];

function send(metric: ReportedMetric): void {
  if (!ACCEPTED.has(metric.name)) return;
  const report: WebVitalReport = {
    name: metric.name as WebVitalReport["name"],
    // CLS é adimensional (pequeno); as demais métricas são em milissegundos.
    value: metric.name === "CLS" ? Math.round(metric.value * 10_000) / 10_000 : Math.round(metric.value),
    route: normalizeRoute(window.location.pathname),
    ...("rating" in metric && typeof metric.rating === "string" ? { rating: metric.rating } : {}),
    ...("navigationType" in metric && typeof metric.navigationType === "string" ? { navigationType: metric.navigationType } : {}),
  };
  const body = JSON.stringify(report);
  try {
    // sendBeacon sobrevive ao fechamento da aba; fetch keepalive é o plano B.
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) return;
    void fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => undefined);
  } catch {
    // Medição é best-effort: nunca interfere na navegação.
  }
}

/** Envia Core Web Vitals reais (dados de campo) ao próprio servidor. Sem cookies, sem identificação. */
export function WebVitalsReporter() {
  useReportWebVitals(send);
  return null;
}
