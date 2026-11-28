# SEO_URL_INVENTORY

Fonte única da classificação: `src/lib/seo/routes.ts` (`classifyPath`). O teste `tests/unit/seo-routes.test.ts` percorre `src/app` e falha se uma rota nova não for classificada.

| URL | Classe | HTTP anônimo | Indexação | Canônica | No sitemap |
|---|---|---|---|---|---|
| `/` | indexable | 200 | index | `/` | sim (sem lastmod) |
| `/privacidade` | indexable | 200 | index | `/privacidade` | sim (lastmod 2026-11-27) |
| `/termos` | indexable | 200 | index | `/termos` | sim (lastmod 2026-11-26) |
| `/login`, `/cadastro`, `/recuperar-senha` | public-noindex | 200 | noindex (meta + cabeçalho) | — | não |
| `/callback` | public-noindex | redireciona | noindex | — | não |
| `/offline` | public-noindex | 200 | noindex | — | não |
| `/robots.txt`, `/sitemap.xml`, `/manifest.json` | public-noindex | 200 | noindex (cabeçalho) | — | — |
| `/api/vitals` (POST) | public-noindex | 204/4xx | bloqueado no robots | — | não |
| `/api/webhooks/*`, `/api/cron/*` | public-noindex | 401/503 sem segredo | bloqueado no robots | — | não |
| `/mfa`, `/mfa/configurar`, `/redefinir-senha` | protected | 307 → `/login?next=` | noindex | — | não |
| `/selecionar-igreja`, `/entrar/[codigo]` | protected | 307 | noindex | — | não |
| `/dashboard`, `/agenda[/…]`, `/biblia[/…]`, `/celulas[/…]`, `/comunicados`, `/configuracoes`, `/contribuir[/…]`, `/disponibilidade`, `/familias`, `/financeiro[/exportar]`, `/membros`, `/ministerios[/…]`, `/notificacoes`, `/oracao`, `/repertorio[/…]`, `/visitantes` | protected | 307 | noindex | — | não |
| `/palco/[versionId]` | protected | 307 | noindex | — | não |
| `/api/ai/*`, `/api/me/*` | protected | 307 | bloqueado no robots | — | não |
| qualquer outro caminho | unknown | **404** | noindex | — | não |

Variações: `/termos/` → 308 `/termos` (um salto). Parâmetros (`/login?next=…`) não têm canônica e são `noindex`.
