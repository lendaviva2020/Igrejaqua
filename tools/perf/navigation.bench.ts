/**
 * Benchmark de navegação autenticada (build de produção + pilha isolada + proxy de latência).
 * Mede, por rota do menu lateral:
 *  - carga completa do documento: TTFB, DOMContentLoaded, load, JS transferido e chamadas ao backend;
 *  - navegação client-side (clique no menu): tempo até o primeiro retorno visual e até o conteúdo final,
 *    tarefas longas na thread principal e duração do evento de clique (aproximação local do INP).
 *
 * Resultado em .stack/perf/<IQ_PERF_LABEL>.json. Valores são de laboratório (condições controladas),
 * não dados de campo: servem para comparar antes/depois, não para declarar Core Web Vitals.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { STATE } from "../../tests/stack/helpers.ts";

const PROXY = process.env["IQ_PERF_PROXY_URL"] ?? "http://127.0.0.1:54402";
const LABEL = process.env["IQ_PERF_LABEL"] ?? "resultado";
const ROUNDS = Number(process.env["IQ_PERF_ROUNDS"] ?? "3");
/** RTT adicional navegador ↔ servidor (ex.: 180 para celular no Brasil ↔ datacenter nos EUA). 0 = rede local. */
const BROWSER_RTT_MS = Number(process.env["IQ_PERF_BROWSER_RTT_MS"] ?? "0");
const ROUTES = ["/agenda", "/ministerios", "/repertorio", "/oracao", "/biblia", "/comunicados", "/contribuir", "/disponibilidade", "/notificacoes", "/celulas", "/membros", "/familias", "/visitantes", "/financeiro", "/configuracoes", "/dashboard"] as const;

interface ProxyStats { readonly total: number; readonly auth: number; readonly rest: number; readonly byRoute: Readonly<Record<string, number>> }
interface DocumentSample { readonly route: string; readonly ttfbMs: number; readonly domContentLoadedMs: number; readonly loadMs: number; readonly jsTransferBytes: number; readonly jsDecodedBytes: number; readonly backendCalls: number; readonly authCalls: number; readonly restCalls: number }
interface NavSample { readonly route: string; readonly round: number; readonly feedbackMs: number; readonly doneMs: number; readonly longTaskMs: number; readonly clickEventMs: number; readonly timedOut: boolean }

async function proxyStats(page: Page): Promise<ProxyStats> {
  const r = await page.request.get(`${PROXY}/__stats`);
  return (await r.json()) as ProxyStats;
}
async function proxyReset(page: Page): Promise<void> {
  await page.request.post(`${PROXY}/__reset`);
}

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[index] ?? Number.NaN);
}

async function measureDocument(page: Page, route: string): Promise<DocumentSample> {
  await proxyReset(page);
  const response = await page.goto(route, { waitUntil: "load" });
  expect(response?.status() ?? 0, `HTTP em ${route}`).toBeLessThan(400);
  // As chamadas do servidor terminam antes do HTML; o que vier depois é prefetch, que não entra na conta.
  const stats = await proxyStats(page);
  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const js = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).filter((e) => e.name.endsWith(".js") || e.initiatorType === "script");
    return {
      ttfb: nav ? nav.responseStart - nav.startTime : -1,
      dcl: nav ? nav.domContentLoadedEventEnd - nav.startTime : -1,
      load: nav ? nav.loadEventEnd - nav.startTime : -1,
      jsTransfer: js.reduce((sum, e) => sum + e.transferSize, 0),
      jsDecoded: js.reduce((sum, e) => sum + e.decodedBodySize, 0),
    };
  });
  return { route, ttfbMs: Math.round(timing.ttfb), domContentLoadedMs: Math.round(timing.dcl), loadMs: Math.round(timing.load), jsTransferBytes: timing.jsTransfer, jsDecodedBytes: timing.jsDecoded, backendCalls: stats.total, authCalls: stats.auth, restCalls: stats.rest };
}

/** Instala, antes do clique, observadores que marcam o primeiro retorno visual e a chegada do conteúdo final. */
async function clickAndMeasure(page: Page, route: string, round: number): Promise<NavSample> {
  await page.evaluate((target) => {
    const w = window as unknown as { __iqNav: { start: number; feedback: number; done: number; longTasks: number; clickEvent: number } };
    const startH1 = document.querySelector("main h1")?.textContent ?? "";
    const state = { start: 0, feedback: -1, done: -1, longTasks: 0, clickEvent: 0 };
    w.__iqNav = state;
    new PerformanceObserver((list) => { for (const e of list.getEntries()) if (state.start > 0 && e.startTime >= state.start) state.longTasks += e.duration; }).observe({ type: "longtask", buffered: false });
    new PerformanceObserver((list) => { for (const e of list.getEntries()) if (e.name === "click" || e.name === "pointerup") state.clickEvent = Math.max(state.clickEvent, e.duration); }).observe({ type: "event", buffered: false, durationThreshold: 16 } as PerformanceObserverInit);
    document.addEventListener("pointerdown", () => { state.start = performance.now(); }, { once: true, capture: true });
    const tick = (): void => {
      if (state.start > 0) {
        const h1 = document.querySelector("main h1")?.textContent ?? "";
        const busy = document.querySelector('main [aria-busy="true"]') !== null;
        const onTarget = location.pathname === target;
        if (state.feedback < 0 && (busy || onTarget || h1 !== startH1)) state.feedback = performance.now() - state.start;
        if (onTarget && !busy && h1 !== "" && h1 !== startH1) { state.done = performance.now() - state.start; return; }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, route);
  await page.locator(`aside a[href="${route}"]`).click();
  const finished = await page.waitForFunction(() => (window as unknown as { __iqNav: { done: number } }).__iqNav.done >= 0, undefined, { timeout: 15_000 }).then(() => true, () => false);
  await page.waitForTimeout(150);
  const s = await page.evaluate(() => (window as unknown as { __iqNav: { feedback: number; done: number; longTasks: number; clickEvent: number } }).__iqNav);
  return { route, round, feedbackMs: Math.round(s.feedback), doneMs: Math.round(s.done), longTaskMs: Math.round(s.longTasks), clickEventMs: Math.round(s.clickEvent), timedOut: !finished };
}

test.use({ storageState: STATE("admin"), viewport: { width: 1440, height: 900 } });

test("benchmark de navegação (administrador, desktop)", async ({ page }) => {
  test.setTimeout(20 * 60_000);
  if (BROWSER_RTT_MS > 0) {
    // Emulação de rede do Chromium: soma a latência a cada requisição do navegador (não afeta o proxy de backend).
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: BROWSER_RTT_MS, downloadThroughput: -1, uploadThroughput: -1 });
  }
  const documents: DocumentSample[] = [];
  for (let round = 0; round < ROUNDS; round += 1) {
    for (const route of ROUTES) documents.push(await measureDocument(page, route));
  }

  const navigations: NavSample[] = [];
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  for (let round = 0; round < ROUNDS; round += 1) {
    for (const route of ROUTES) {
      if (page.url().endsWith(route)) continue;
      navigations.push(await clickAndMeasure(page, route, round));
    }
  }

  const byRoute = ROUTES.map((route) => {
    const docs = documents.filter((d) => d.route === route);
    const navs = navigations.filter((n) => n.route === route && !n.timedOut);
    return {
      route,
      ttfbP50: percentile(docs.map((d) => d.ttfbMs), 50),
      loadP50: percentile(docs.map((d) => d.loadMs), 50),
      backendCalls: percentile(docs.map((d) => d.backendCalls), 50),
      authCalls: percentile(docs.map((d) => d.authCalls), 50),
      jsTransferKb: Math.round(percentile(docs.map((d) => d.jsTransferBytes), 50) / 1024),
      navFeedbackP75: percentile(navs.map((n) => n.feedbackMs), 75),
      navDoneP50: percentile(navs.map((n) => n.doneMs), 50),
      navDoneP75: percentile(navs.map((n) => n.doneMs), 75),
    };
  });
  const valid = navigations.filter((n) => !n.timedOut);
  const summary = {
    label: LABEL,
    rounds: ROUNDS,
    browserRttMs: BROWSER_RTT_MS,
    measuredAt: new Date().toISOString(),
    overall: {
      ttfbP50: percentile(documents.map((d) => d.ttfbMs), 50),
      ttfbP75: percentile(documents.map((d) => d.ttfbMs), 75),
      backendCallsP50: percentile(documents.map((d) => d.backendCalls), 50),
      navFeedbackP75: percentile(valid.map((n) => n.feedbackMs), 75),
      navDoneP50: percentile(valid.map((n) => n.doneMs), 50),
      navDoneP75: percentile(valid.map((n) => n.doneMs), 75),
      longTaskP75: percentile(valid.map((n) => n.longTaskMs), 75),
      clickEventP75: percentile(valid.map((n) => n.clickEventMs), 75),
      timeouts: navigations.length - valid.length,
    },
    byRoute,
    raw: { documents, navigations },
  };
  mkdirSync(".stack/perf", { recursive: true });
  writeFileSync(`.stack/perf/${LABEL}.json`, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify({ overall: summary.overall, byRoute }, null, 2));
  expect(summary.overall.timeouts, "navegações que não terminaram em 15 s").toBe(0);
});
