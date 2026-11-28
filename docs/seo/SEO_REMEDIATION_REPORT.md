# SEO_REMEDIATION_REPORT

Formato por item: **antes** · evidência · correção · arquivos · teste · resultado · pendência externa.
Testes citados: `tests/unit/seo-routes.test.ts` (U-routes), `tests/unit/seo-structured-data.test.ts` (U-ld), `tests/e2e/seo.spec.ts` (E-seo), `tests/e2e/public-and-guards.spec.ts` (E-guard). Saídas na seção "Homologação" do relatório de performance.

| # | Antes | Evidência | Correção | Arquivos | Teste | Resultado | Pendência externa |
|---|---|---|---|---|---|---|---|
| 1 SSR | ✅ | HTML inicial com conteúdo | nenhuma necessária | — | E-seo (h1 único, títulos) | ✅ | — |
| 2 `#` | ✅ | só âncoras da página | nenhuma | — | E-seo (links sem `#` vazio) | ✅ | — |
| 3 robots.txt | ❌ inexistente e 307 p/ login | inventário de rotas do proxy | `app/robots.ts`; caminho público e sem ida ao Auth | `src/app/robots.ts`, `src/proxy.ts`, `src/lib/seo/routes.ts` | U-routes, E-seo | ✅ 200 `text/plain` | — |
| 4 Redirects | ◐ | barra final 308 nativo; sem cadeias | 307 de área privada agora leva `X-Robots-Tag`; 404 no lugar do redirecionamento para caminhos inexistentes | `src/proxy.ts` | E-seo (308 em 1 salto), E-guard | ✅ no app | HTTP→HTTPS/www/domínio na Vercel (guia §0) |
| 5 Title | ◐ | home sem assunto; legais sem descrição | home `absolute` "IGREJAQUA · Gestão de igreja, escalas e louvor"; descrições próprias para legais | `(marketing)/page.tsx`, `privacidade/page.tsx`, `termos/page.tsx`, `layout.tsx` | E-seo (3 títulos distintos ≤ 65, descrição > 50) | ✅ | — |
| 6 Organization | ❌ | sem JSON-LD | Organization + WebSite, `sameAs` só de env https | `src/lib/seo/structured-data.ts`, home | U-ld, E-seo | ✅ | Validar no Rich Results Test após deploy; confirmar que `NEXT_PUBLIC_SOCIAL_*` são perfis oficiais |
| 7 Alt / imagens | ◐ | 171 KB p/ 220 px; `unoptimized` | `next/image` otimizado; `preload` só no LogoFull (candidato a LCP do login); emblema lazy | `src/components/shared/logo.tsx` | E-seo (alt presente, width/height) | ✅ | — |
| 8 Links | ✅ | — | indicador de pendência sem alterar `href` | `nav-links.tsx` | E-seo (todos os links internos < 400) | ✅ | — |
| 9 Sitemap | ❌ | inexistente | `app/sitemap.ts` a partir de `INDEXABLE_PATHS`; `lastmod` = data real da página legal | `src/app/sitemap.ts`, `src/lib/seo/content-dates.ts` | U-routes, E-seo (XML, 3 URLs, cada uma 200 + canônica) | ✅ | Enviar no Search Console (guia §2) |
| 10 Noindex | ❌ (nada protegido) | nenhum `noindex` | meta nos layouts privados + `X-Robots-Tag` no proxy | layouts `(auth)/(app)/(onboarding)/(stage)`, `offline`, `src/proxy.ts` | E-seo | ✅ | — |
| 11 404 | ❌ soft 404 | anônimo → 307 /login | 404 real + `not-found.tsx` | `src/app/not-found.tsx`, `src/proxy.ts` | E-seo (3 caminhos → 404), U-routes (cobertura do FS) | ✅ | — |
| 12 Canonical | ❌ | sem `metadataBase` | `metadataBase` = `siteOrigin()`; canônica só nas 3 públicas | `layout.tsx`, páginas públicas | E-seo | ✅ | Definir `NEXT_PUBLIC_SITE_URL` em produção |
| 13 Órfãs | ✅ | rodapé/cabeçalho | 404 também aponta para home/login | `not-found.tsx` | E-seo (links) | ✅ | — |
| 14 Massa | ✅ | nenhuma | nenhuma página criada | — | — | ✅ | — |
| 15–17 CWV | ⊘ | sem dados de campo | coleta própria de Web Vitals (sem terceiros), imagens otimizadas, ver relatório de performance | `src/components/perf/*`, `src/app/api/vitals/route.ts` | E-seo (`/api/vitals`) | ⊘ até haver tráfego | Ler p75 nos logs e no Search Console |
| 18 Texto | ✅ | afirmações conferidas no código | política de privacidade passa a declarar a medição anônima de desempenho (data atualizada para 27/11/2026) | `privacidade/page.tsx`, `content-dates.ts` | — | ✅ | Revisão do texto legal pelo responsável |
| 19 Autor | n/a | sem conteúdo editorial público | não criado (seria página vazia) | — | — | n/a | Reavaliar se houver blog/devocional público |

## Segurança (sem regressões)
- Nenhuma rota privada passou a responder sem sessão: a lista `PROTECTED_PREFIXES` cobre todas as rotas de `(app)`, `(onboarding)`, `(stage)`, `/mfa`, `/redefinir-senha`, `/api/ai`, `/api/me` (teste lê o sistema de arquivos). Os redirecionamentos de E-guard continuam passando.
- RLS, `getUser()` e CSP com nonce inalterados.
