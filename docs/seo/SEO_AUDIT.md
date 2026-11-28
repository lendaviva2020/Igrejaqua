# SEO_AUDIT — Gate SEO 1.0 (auditoria inicial)

Data: 2026-11-27 · Commit auditado: `f6d3d15` (antes das correções) · Stack: Next.js 16.4.6 (App Router, `src/app`), React 19.3, Supabase SSR 0.12, Tailwind 4, deploy Vercel.

Legenda: ✅ aprovado · ❌ reprovado · ◐ parcial · ⊘ não verificável daqui.

## Método
- Leitura de todo `src/app`, `src/proxy.ts`, `next.config.ts`, layouts e componentes de marca.
- Build de produção (`next build`) e respostas HTTP reais com `next start` (Playwright `request`).
- Configuração do projeto Vercel e do Supabase lidas pelos conectores (somente leitura).
- Produção (`igrejaqua.vercel.app`) **não pôde ser acessada** deste ambiente (proxy de rede bloqueia o host): todo item que depende da resposta de produção está marcado ⊘.

## Estrutura encontrada
| Grupo | Rotas | Natureza |
|---|---|---|
| `(marketing)` | `/`, `/privacidade`, `/termos`, `/offline` | públicas (3 com valor de busca) |
| `(auth)` | `/login`, `/cadastro`, `/recuperar-senha`, `/redefinir-senha`, `/mfa`, `/mfa/configurar`, `/callback` | autenticação |
| `(onboarding)` | `/selecionar-igreja`, `/entrar/[codigo]` | privadas |
| `(app)` | 16 módulos + detalhes (`/agenda/[id]` etc.) | privadas, multi-tenant |
| `(stage)` | `/palco/[versionId]` | privada |
| `api` | `ai`, `me`, `cron`, `webhooks` | APIs |

Todas as rotas são dinâmicas (`ƒ`) porque o layout raiz chama `connection()` para a CSP com nonce. O HTML inicial das páginas públicas é renderizado no servidor (Server Components), portanto indexável.

## Resultado por item
| # | Item | Status | Evidência |
|---|---|---|---|
| 1 | Renderização no servidor | ✅ | Páginas públicas são Server Components; `curl` do `/` devolve o `h1` e todo o texto no HTML. |
| 2 | URLs com `#` | ✅ | Só âncoras legítimas da mesma página (`#plataforma`, `#louvor`, `#conteudo`). Nenhuma rota por fragmento. |
| 3 | robots.txt | ❌ | Não existia. Pior: `/robots.txt` não estava nas rotas públicas do proxy → visitante anônimo recebia **307 para /login**. |
| 4 | Redirects | ◐ | Sem cadeias no app. Barra final → 308 nativo do Next. HTTP→HTTPS/domínio: Vercel (⊘). Sem domínio próprio configurado. |
| 5 | Title único | ◐ | Template `%s · IGREJAQUA` existia; home "Organização que aproxima · IGREJAQUA" (sem a marca/assunto em destaque). Legais sem `description` (herdavam a genérica, duplicada). |
| 6 | Organization / sameAs | ❌ | Sem JSON-LD. |
| 7 | Alt text | ◐ | Logos com `alt` correto (decorativo vazio quando ao lado do nome). Mas `logo.webp` (171 KB, 960×757) e `emblema.webp` servidos com `unoptimized` para exibição a 220 px / 24–56 px. |
| 8 | Links com `href` | ✅ | Navegação 100% `<Link>`/`<a href>`; `router.push` só após envio de formulário. |
| 9 | sitemap.xml | ❌ | Não existia; também caía no redirecionamento para /login. |
| 10 | Noindex esquecido | ❌ (inverso) | Nenhum `noindex` em lugar algum: login, cadastro, MFA e telas internas eram indexáveis se descobertas. Nenhum noindex acidental em página pública. |
| 11 | Página morta = 404 | ❌ | Anônimo em `/qualquer-coisa` recebia **307 → /login** (soft 404). Não havia `not-found.tsx` personalizado. |
| 12 | Canonical | ❌ | Sem `metadataBase` e sem canônicas. `/login?next=…` gera variações por parâmetro. |
| 13 | Páginas órfãs | ✅ | `/privacidade` e `/termos` ligadas pelo rodapé; `/cadastro` e `/login` pelo cabeçalho. |
| 14 | Páginas em massa | ✅ | Nenhuma geração programática pública. Rotas com parâmetro (`/biblia/[livro]/[capitulo]`, `/entrar/[codigo]`) são privadas. |
| 15–17 | INP / LCP / CLS | ⊘ | Não havia coleta de campo. Laboratório: ver `docs/performance/PERFORMANCE_BASELINE.md`. |
| 18 | Texto | ✅ | Afirmações da landing conferidas no código (IA desligada por padrão: `churches.ai_enabled default false`; oração anônima: `prayer_requests.is_anonymous`; troca de tom: `src/lib/music-theory`; confirmação de escala: `respondLineupAction`). Sem números, depoimentos ou eventos fictícios. |
| 19 | Bio do autor | n/a | Não existe conteúdo editorial público; comunicados/devocionais são privados de cada igreja. |
| — | Acesso do Googlebot | ⊘ (risco alto) | Projeto Vercel com **Vercel Authentication `all_except_custom_domains`** e **nenhum domínio próprio**. Ver SEO_SEARCH_CONSOLE_GUIDE §0. |

## Correções necessárias (todas aplicadas, ver SEO_REMEDIATION_REPORT.md)
robots.txt e sitemap.xml públicos · 404 real para caminhos inexistentes · `noindex` (meta + `X-Robots-Tag`) para tudo que não é institucional · `metadataBase` + canônica autorreferente nas 3 páginas públicas · títulos/descrições únicos · JSON-LD Organization+WebSite com dados reais · otimização das imagens de marca · coleta de Web Vitals de campo.
