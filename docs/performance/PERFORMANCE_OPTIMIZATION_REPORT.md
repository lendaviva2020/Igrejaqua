# PERFORMANCE_OPTIMIZATION_REPORT — Gate P0

Método e limites: `PERFORMANCE_BASELINE.md`. Todos os números são de laboratório (build de produção + pilha isolada + latência injetada), comparados nas mesmas condições.

## 1. Os cinco maiores gargalos e o que foi feito
| # | Gargalo (evidência no AUDIT) | Correção | Arquivos |
|---|---|---|---|
| 1 | Cascata serial de ~7 idas e voltas antes do HTML | `resolveChurchContext` e `requireUser` memoizados por requisição (`React.cache`); **removida a consulta redundante** do vínculo (o id já vinha em `listMyChurches`, mesmo filtro `user_id + status=active`); MFA e permissões de ministério **em paralelo**. A decisão de MFA continua sendo aplicada antes de qualquer uso das permissões. | `src/lib/auth/context.ts` |
| 2 | Funções em **iad1** e banco em **us-west-2** | `vercel.json` → `"regions": ["pdx1"]` (Portland, mesma região AWS do Supabase). | `vercel.json` |
| 3 | Rajada de prefetch: 36 req. RSC e 37 `getUser` no Auth por página | 5 itens principais (os da barra inferior) mantêm o prefetch automático; os 11 secundários pré-carregam **por intenção** (hover, foco, toque). Recursos sem sessão (`robots`, `sitemap`, `manifest`, webhooks, cron, vitals) não chamam mais o Auth no proxy. | `src/components/layout/nav-links.tsx`, `src/proxy.ts` |
| 4 | Clique sem retorno visual | Indicador de link pendente (`useLinkStatus`) no menu lateral e na barra inferior, com atraso de 100 ms para não piscar em navegações rápidas. | `src/components/layout/nav-links.tsx` |
| 5 | Imagens de marca sem otimização | `next/image` otimizado (AVIF/WebP no tamanho exibido); `preload` só na logo do login; emblema com carregamento lazy (a cópia oculta por CSS não é baixada). Logo do login **171 KB → 20 KB** (1x) / 73 KB (2x); emblema **38 KB → 2 KB**. | `src/components/shared/logo.tsx` |

Correção extra encontrada pelo passeio autenticado (já existia antes deste trabalho): **erro de hidratação React #418 em `/agenda/[id]`**. `AttendancePanel` (Client Component) formatava horários sem `timeZone`: o servidor renderizava em UTC e o navegador no fuso local. Além do horário errado, o React descartava o HTML do servidor e renderizava de novo no cliente. Agora usa o fuso da igreja. Arquivos: `attendance-panel.tsx`, `agenda/[eventId]/page.tsx`.

## 2. Antes × depois (backend 40 ms por chamada, RTT do navegador 0)
| Métrica | Antes | Depois | Variação |
|---|---|---|---|
| TTFB p50 / p75 | 287 / 297 ms | **243 / 251 ms** | −15% |
| DOMContentLoaded p50 | 311 ms | 266 ms | −14% |
| load p50 | 354 ms | 308 ms | −13% |
| Navegação pelo menu, conteúdo final p50 / p75 | 281 / 284 ms | **246 / 248 ms** | −12% |
| Chamadas ao backend por documento p50 | 32 | **18** | −44% |
| Prefetch por página aberta (desktop, 4 s) | 36 req. / 37 chamadas Auth | **12 req. / 15 chamadas Auth** | −67% / −59% |
| Prefetch por página aberta (celular 390 px) | — | 14 req. / 17 Auth | — |
| Long tasks p75 / evento de clique p75 | 0 / 16 ms | 0 / 16 ms | sem regressão |
| JS total do build (gzip) | 362 KB | 366 KB | +4 KB (coletor de Web Vitals + estado do menu) |

Por rota (TTFB p50 · chamadas · navegação p50, antes → depois):

| Rota | TTFB | Chamadas | Navegação |
|---|---|---|---|
| `/dashboard` | 287 → 242 | 33 → 19 | 282 → 248 |
| `/agenda` | 288 → 243 | 32 → 22 | 282 → 247 |
| `/ministerios` | 279 → 242 | 28 → 18 | 280 → 246 |
| `/repertorio` | 287 → 243 | 31 → 18 | 280 → 246 |
| `/oracao` | 291 → 241 | 33 → 20 | 283 → 245 |
| `/biblia` | 278 → 244 | 27 → 13 | 64 → 63 |
| `/comunicados` | 339 → 288 | 37 → 33 | 329 → 292 |
| `/contribuir` | 297 → 243 | 32 → 21 | 283 → 246 |
| `/disponibilidade` | 285 → 239 | 31 → 18 | 280 → 245 |
| `/notificacoes` | 283 → 240 | 32 → 18 | 280 → 247 |
| `/celulas` | 285 → 246 | 33 → 17 | 281 → 248 |
| `/membros` | 286 → 244 | 33 → 20 | 283 → 246 |
| `/familias` | 282 → 248 | 33 → 17 | 281 → 246 |
| `/visitantes` | 291 → 243 | 31 → 16 | 280 → 247 |
| `/financeiro` | 281 → 249 | 33 → 18 | 284 → 247 |
| `/configuracoes` | 295 → 253 | 35 → 22 | 284 → 247 |

### Efeito esperado da mudança de região (gargalo 2)
Mesmo código, variando só a latência por chamada: **70 ms → 460 ms de TTFB** e **10 ms → ~95 ms de TTFB** (laboratório). A latência real iad1↔us-west-2 e pdx1↔us-west-2 **não foi medida** (produção inacessível daqui). Confirme com os logs `web_vital` (TTFB) antes e depois do deploy.

## 3. Decisão registrada: `loading.tsx` global foi testado e descartado
Foi implementado e medido em A/B (3 variantes: original, com e sem `loading.tsx`):

| Backend / RTT do navegador | Variante | Retorno visual p75 | Conteúdo final p50 |
|---|---|---|---|
| 70 ms / 180 ms | original | 464 | 463 |
| 70 ms / 180 ms | com `loading.tsx` | **30** | 396 |
| 70 ms / 180 ms | sem `loading.tsx` | 400 | 396 |
| 10 ms / 180 ms | original | 198 | 197 |
| 10 ms / 180 ms | com `loading.tsx` | 33 | **329** |
| 10 ms / 180 ms | sem `loading.tsx` | 197 | **197** |

Motivos para descartar:
1. **Correção:** com a fronteira de streaming, o status HTTP sai antes de a página chamar `notFound()`. As barreiras de permissão ("membro em /financeiro") passaram a responder **200 em vez de 404**. Não houve vazamento de dados, mas o contrato de segurança do passeio quebrou e isso também gera soft 404. Corrigir exigiria levar as verificações de permissão de 23 páginas para layouts.
2. **Desempenho com backend rápido:** o React segura a troca fallback→conteúdo por no mínimo 300 ms (`globalMostRecentFallbackTime + 300` no React bundled pelo Next). Com as funções na região do banco, o conteúdo ficaria ~130 ms mais lento.

Critério de reversão: se os dados de campo mostrarem `Next.js-route-change-to-render` p75 > 500 ms depois da mudança de região, reavalie `loading.tsx` **por rota** (só nas que não usam `notFound()` para permissão).

## 4. Cache
Nenhum cache de dados foi adicionado. Todas as respostas de área privada continuam `private, no-store` (proxy), e o Router Cache do cliente fica no padrão do Next (por usuário, em memória). Não há chave compartilhada entre igrejas ou usuários. Também não havia dado público e caro o bastante para justificar cache: as páginas públicas são texto estático renderizado sob demanda por causa da CSP com nonce.

## 5. Monitoramento em produção
- **Web Vitals de campo, sem terceiros:** `src/components/perf/web-vitals-reporter.tsx` (`useReportWebVitals`) envia LCP, INP, CLS, FCP, TTFB e as métricas de navegação do Next (`Next.js-route-change-to-render`, `-render`, `-hydration`) por `sendBeacon` para `POST /api/vitals`.
- O endpoint (`src/app/api/vitals/route.ts`) valida com Zod `.strict()`, limita o corpo a 1 KB, recusa `sec-fetch-site: cross-site` e grava **uma linha JSON** `{"event":"web_vital",name,value,rating,navigationType,route}` no log de runtime. Sem cookie, sessão, IP, user-agent ou id: a rota é reduzida ao padrão (`/agenda/:param`).
- Foi escolhido no lugar do Vercel Speed Insights porque a Política de Privacidade afirma "não há ferramentas de análise de terceiros". A política agora declara a medição anônima de desempenho (texto e data atualizados, revisão do responsável pendente).
- **Como ler:** Vercel → Logs → filtro `web_vital` (ou MCP `get_runtime_logs` com `query: "web_vital"`). Agrupe por `name` + `route` e calcule o p75. Metas: LCP ≤ 2500, INP ≤ 200, CLS ≤ 0,1, `Next.js-route-change-to-render` ≤ 500.
- **Laboratório:** `npm run perf:bench` com a pilha isolada (ver `PERFORMANCE_BASELINE.md`).

## 6. Resultado dos testes (homologação, 2026-11-28)
| Verificação | Comando | Resultado |
|---|---|---|
| TypeScript | `npm run typecheck` | ✅ sem erros |
| ESLint | `npm run lint` | ✅ sem erros |
| Unitários | `npm test` | ✅ 28 arquivos, **233 testes** (inclui `seo-routes`, `seo-structured-data`) |
| Build de produção | `npm run build` | ✅ |
| E2E público (2 dispositivos) | `npm run test:e2e` | ✅ **310 passaram**, 10 ignorados (SEO só no desktop) |
| Passeio autenticado (admin+MFA, líder, membro; 390/820/1440) | `npm run test:stack` | ✅ **132 passaram**: HTTP < 400, sem erro de página/console, sem rolagem horizontal, 404 nas barreiras de permissão |
| pgTAP | `npm run test:sql` | não executado: nenhuma migration nova ou alterada |

Correção para os testes passarem, que já falhava no código original: os radios do `/cadastro` eram `sr-only` (1×1 px) e reprovavam o teste de alvo de toque ≥ 24 px. O input invisível agora cobre o cartão inteiro (`signup-form.tsx`). O axe continua sem violações.

## 7. Ainda precisa de atenção
1. **Deploy em `pdx1`:** validar o TTFB de campo antes e depois. Melhor solução de longo prazo para usuários no Brasil: Supabase em `sa-east-1` + funções em `gru1` (exige migração do banco; decisão do responsável).
2. **Duas idas ao Auth por navegação** (proxy + render) continuam, por regra do projeto (`getUser()`, nunca `getSession()`). Para reduzir, avalie `getClaims()` com chaves assimétricas (JWKS) **só no proxy**, mantendo `getUser()` no render. É mudança de segurança e precisa de ADR.
3. `/comunicados` executa `publish_due_content` (escrita) antes de listar: uma ida e volta extra por visita. Se o job agendado já publica no horário, a chamada no caminho de leitura pode sair (decisão de domínio).
4. Core Web Vitals: **não declarados aprovados**. Falta dado de campo.
5. Vercel Authentication `all_except_custom_domains` sem domínio próprio: confirme que a produção é pública (ver guia do Search Console §0).
