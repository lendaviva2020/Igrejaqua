# PERFORMANCE_BASELINE — antes das otimizações

Commit `f6d3d15`, **build de produção** (`next build` + `next start`), medido em 2026-11-27.

## Como foi medido (reproduzível)
1. Pilha isolada: `docs/E2E_STACK.md` (Postgres 16, PostgREST 12.2.3, gateway de Auth de teste, dados "de Teste").
2. Proxy de medição entre o app e o backend: `tools/perf/latency-proxy.ts`. Injeta latência fixa por chamada (simula a ida e volta até o Supabase) e conta as chamadas.
3. Benchmark: `npm run perf:bench` (`tools/perf/navigation.bench.ts`). Administrador com MFA, desktop 1440×900, 16 rotas do menu, 3 rodadas. Mede:
   - carga do documento (TTFB, DOMContentLoaded, load, JS, chamadas ao backend);
   - navegação por clique no menu: primeiro retorno visual, conteúdo final, long tasks e duração do evento de clique.
4. Variáveis: `IQ_PERF_LATENCY_MS` (latência por chamada ao backend), `IQ_PERF_BROWSER_RTT_MS` (RTT navegador↔servidor via emulação de rede do Chromium).

**Limites:** são números de laboratório em condições controladas, não dados de campo. Servem para comparar antes e depois. Core Web Vitals só podem ser declarados com dados de campo (ver monitoramento no relatório de otimização).

## Resultado (latência de backend 40 ms, RTT do navegador 0)
| Métrica | Valor |
|---|---|
| TTFB p50 / p75 | **287 / 297 ms** (≈ 7 idas e voltas × 40 ms) |
| DOMContentLoaded p50 | 311 ms |
| load p50 | 354 ms |
| Chamadas ao backend por documento (p50) | **32**, sendo 26 `GET /auth/v1/user` (render + prefetch iniciado antes do `load`) |
| Prefetch por página aberta (4 s) | **36 requisições RSC → 37 chamadas ao Auth** |
| Navegação no menu, primeiro retorno visual p75 | **284 ms** (nada muda na tela até o fim) |
| Navegação no menu, conteúdo final p50 / p75 | 281 / 284 ms |
| Long tasks durante a navegação p75 | 0 ms |
| Evento de clique p75 (aprox. INP de laboratório) | 16 ms |
| JS por página (descomprimido) | ~616 KB; build total 362 KB gzip / 42 chunks |
| Imagem do login (candidata a LCP) | `logo.webp` 171 KB, 960×757, exibida a 220 px |

### Sensibilidade à latência (mesmo código)
| Backend por chamada | RTT navegador | TTFB p50 | Conteúdo final p50 |
|---|---|---|---|
| 10 ms (funções na região do banco) | 0 | 117 ms | 97 ms |
| 10 ms | 180 ms | 100 ms | 197 ms |
| 40 ms | 0 | 287 ms | 281 ms |
| 70 ms (≈ iad1 ↔ us-west-2, situação atual) | 0 | 460 ms | 464 ms |
| 70 ms | 180 ms | 461 ms | 463 ms |

A latência por chamada domina: de 10 para 70 ms, o TTFB quadruplica. É a assinatura da cascata serial (gargalo nº 1) multiplicada pela distância entre regiões (gargalo nº 2).

## Módulos pedidos no escopo
Login, Dashboard (`/dashboard`), Minha Igreja/Configurações (`/configuracoes`), Cultos e Eventos (`/agenda`), Comunidade (`/oracao`, `/comunicados`, `/celulas`), Biblioteca Musical (`/repertorio`), Ensaios e Escalas (`/disponibilidade`, `/ministerios`) e os demais do menu: todos estão na tabela por rota do relatório de otimização. A tela de login não depende do backend para renderizar (TTFB ≈ só o proxy). O LCP dela era a logo não otimizada.
