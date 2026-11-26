import { mkdirSync, appendFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { dbValue, STATE } from "./helpers.ts";

interface Stop { readonly slug: string; readonly path: string; readonly who: "admin" | "leader" | "member"; readonly expect: "ok" | "notfound" }

async function buildStops(): Promise<readonly Stop[]> {
  const q = async (sql: string): Promise<string> => dbValue(sql);
  const eventId = await q("select id::text as v from events where title = 'Culto de domingo'");
  const songId = await q("select id::text as v from songs limit 1");
  const versionId = await q("select id::text as v from song_versions limit 1");
  const ministryId = await q("select id::text as v from ministries where slug = 'louvor'");
  const cellId = await q("select id::text as v from cell_groups limit 1");
  const chargeId = await q("select id::text as v from pix_charges limit 1");
  const adminPages: [string, string][] = [
    ["painel", "/dashboard"], ["agenda", "/agenda"], ["evento", `/agenda/${eventId}`], ["repertorio", "/repertorio"], ["musica", `/repertorio/${songId}`],
    ["palco", `/palco/${versionId}`], ["oracao", "/oracao"], ["ministerios", "/ministerios"], ["ministerio-louvor", `/ministerios/${ministryId}`],
    ["disponibilidade", "/disponibilidade"], ["comunicados", "/comunicados"], ["notificacoes", "/notificacoes"], ["membros", "/membros"], ["familias", "/familias"],
    ["visitantes", "/visitantes"], ["celulas", "/celulas"], ["celula-centro", `/celulas/${cellId}`], ["financeiro", "/financeiro"], ["contribuir", "/contribuir"],
    ["contribuicao", `/contribuir/${chargeId}`], ["configuracoes", "/configuracoes"], ["biblia", "/biblia"], ["biblia-joao-3", "/biblia/joao/3"],
  ];
  const stops: Stop[] = adminPages.map(([slug, path]) => ({ slug: `admin-${slug}`, path, who: "admin", expect: "ok" }));
  for (const [slug, path] of [["painel", "/dashboard"], ["agenda", "/agenda"], ["evento", `/agenda/${eventId}`], ["repertorio", "/repertorio"], ["oracao", "/oracao"], ["ministerios", "/ministerios"], ["disponibilidade", "/disponibilidade"], ["comunicados", "/comunicados"], ["notificacoes", "/notificacoes"], ["contribuir", "/contribuir"], ["biblia", "/biblia"], ["celulas", "/celulas"], ["configuracoes", "/configuracoes"]] as const) {
    stops.push({ slug: `membro-${slug}`, path, who: "member", expect: "ok" });
  }
  stops.push({ slug: "lider-familias", path: "/familias", who: "leader", expect: "ok" }, { slug: "lider-visitantes", path: "/visitantes", who: "leader", expect: "ok" });
  // Barreiras de acesso: quem não tem poder recebe "não encontrado", nunca o conteúdo.
  for (const p of ["/financeiro", "/visitantes", "/familias", "/membros"]) stops.push({ slug: `negado-membro${p.replace("/", "-")}`, path: p, who: "member", expect: "notfound" });
  stops.push({ slug: "negado-lider-financeiro", path: "/financeiro", who: "leader", expect: "notfound" });
  return stops;
}

const OUT = ".stack/shots";
const stops = await buildStops();

async function visit(page: Page, stop: Stop): Promise<{ status: number; overflow: number; errors: string[] }> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 160)}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 160)}`); });
  page.on("response", (r) => { if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url().slice(0, 100)}`); });
  const response = await page.goto(stop.path, { waitUntil: "load" });
  await page.waitForTimeout(500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  return { status: response?.status() ?? 0, overflow, errors };
}

for (const [index, stop] of stops.entries()) {
  test.describe(`passeio`, () => {
    test.use({ storageState: STATE(stop.who) });
    test(`${String(index + 1).padStart(2, "0")} ${stop.slug} (${stop.path})`, async ({ page }, info) => {
      const dir = `${OUT}/${info.project.name}`;
      mkdirSync(dir, { recursive: true });
      const result = await visit(page, stop);
      // Só para a captura de página inteira: a barra inferior (position: fixed) ficaria no meio da imagem; ancora-a no rodapé da página.
      await page.addStyleTag({ content: 'html{position:relative}nav[aria-label="Navegação"]{position:absolute!important;top:auto!important;bottom:0!important}' });
      await page.screenshot({ path: `${dir}/${String(index + 1).padStart(2, "0")}-${stop.slug}.png`, fullPage: true });
      appendFileSync(".stack/report.jsonl", `${JSON.stringify({ project: info.project.name, slug: stop.slug, path: stop.path, ...result })}\n`);
      if (stop.expect === "notfound") {
        expect(result.status, "acesso indevido deveria ser negado").toBe(404);
      } else {
        expect(result.status, `HTTP ${result.status} em ${stop.path}`).toBeLessThan(400);
        expect(result.errors, `erros na página: ${result.errors.join(" | ")}`).toEqual([]);
      }
      expect(result.overflow, `rolagem horizontal de ${result.overflow}px`).toBeLessThanOrEqual(0);
    });
  });
}
