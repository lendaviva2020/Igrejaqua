/** Junta as capturas de desktop e celular de cada tela numa única imagem legenda + lado a lado (tamanho real). */
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ROOT = ".stack/shots";
const OUT = ".stack/composites";
const WHO: Record<string, string> = { admin: "Administrador", membro: "Membro", lider: "Líder" };
const WORDS: Record<string, string> = {
  painel: "Painel", agenda: "Agenda", evento: "Detalhe do evento", repertorio: "Repertório", musica: "Detalhe da música", palco: "Modo palco (cifra para o palco)",
  oracao: "Pedidos de oração", ministerios: "Ministérios", "ministerio-louvor": "Ministério de Louvor", disponibilidade: "Disponibilidade", comunicados: "Comunicados e devocionais",
  notificacoes: "Notificações", membros: "Membros e convites", familias: "Famílias", visitantes: "Visitantes", celulas: "Células", "celula-centro": "Detalhe da célula",
  financeiro: "Financeiro (livro-caixa)", contribuir: "Contribuições (Pix)", contribuicao: "Detalhe da contribuição", configuracoes: "Configurações", biblia: "Bíblia (livros)", "biblia-joao-3": "Bíblia (capítulo)",
};

const files = readdirSync(`${ROOT}/desktop`).filter((f) => !f.includes("negado")).sort();
const browser = await chromium.launch(process.env["IQ_E2E_CHROME"] ? { executablePath: process.env["IQ_E2E_CHROME"] } : {});
mkdirSync(OUT, { recursive: true });
const uri = (path: string): string => `data:image/png;base64,${readFileSync(path).toString("base64")}`;
for (const file of files) {
  const match = /^(\d+)-(admin|membro|lider)-(.+)\.png$/.exec(file);
  if (match === null) continue;
  const [, num = "", who = "", rest = ""] = match;
  const title = `${WHO[who] ?? who} · ${WORDS[rest] ?? rest}`;
  const page = await browser.newPage({ viewport: { width: 1900, height: 900 } });
  await page.setContent(`<body style="margin:0;background:#0b0f19;color:#e8eaf0;font-family:sans-serif">
    <div style="padding:14px 20px;font-size:20px;border-bottom:1px solid #2a3350"><b>${num}</b> — ${title}</div>
    <div style="display:flex;gap:28px;align-items:flex-start;padding:20px">
      <figure style="margin:0"><figcaption style="margin-bottom:8px;font-size:14px;color:#9aa3b8">Computador (1440 px)</figcaption><img style="width:1440px;display:block;border:1px solid #2a3350" src="${uri(`${ROOT}/desktop/${file}`)}"></figure>
      <figure style="margin:0"><figcaption style="margin-bottom:8px;font-size:14px;color:#9aa3b8">Celular (390 px)</figcaption><img style="width:390px;display:block;border:1px solid #2a3350" src="${uri(`${ROOT}/mobile/${file}`)}"></figure>
    </div></body>`);
  await page.screenshot({ path: `${OUT}/${file}`, fullPage: true });
  await page.close();
}
await browser.close();
console.log(`${files.length} composições em ${OUT}`);
