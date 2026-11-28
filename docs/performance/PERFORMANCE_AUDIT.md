# PERFORMANCE_AUDIT — Gate P0

Data: 2026-11-27 · Commit auditado: `f6d3d15`.

## Stack instalada (package-lock)
Next.js 16.4.6 (App Router, Turbopack, `proxy.ts`), React 19.3.1, @supabase/ssr 0.12.7, @supabase/supabase-js 2.119, Tailwind 4.3, Zod 4.6, lucide-react 1.80 (imports nomeados). Produção na Vercel, Node 26.

## Infraestrutura (lida pelos conectores, somente leitura)
| Item | Valor | Impacto |
|---|---|---|
| Região das funções Vercel (deploy `dpl_G7G1…`) | **iad1** (Virgínia, EUA) | — |
| Região do Supabase (`Igrejaqua`) | **us-west-2** (Oregon, EUA) | cada ida e volta função→banco cruza os EUA (~60–70 ms) |
| Proteção de deploy | Vercel Authentication `all_except_custom_domains`, sem domínio próprio | ver guia do Search Console §0 |

## Arquitetura de navegação
- Layout raiz dinâmico (`connection()`) por causa da CSP com nonce: tudo é renderizado por requisição. Isso é correto (CSP) e não foi alterado.
- `(app)/layout.tsx` chama `resolveChurchContext()` + contagem de notificações; cada página chama `resolveChurchContext()` de novo.
- **Sem `loading.tsx`, `error.tsx` ou `not-found.tsx`** em nenhum segmento.
- Menu lateral com 16 `<Link>` visíveis (prefetch automático por viewport).

## Gargalos encontrados (com evidência)
Medição: build de produção, pilha isolada (Postgres 16 + PostgREST 12.2.3 + gateway de Auth de teste, `docs/E2E_STACK.md`) e proxy que injeta latência e conta chamadas (`tools/perf/latency-proxy.ts`).

1. **Cascata serial no servidor (~7 idas e voltas antes do HTML).** Com 40 ms por chamada, o TTFB foi de 287 ms ≈ 7 × 40. Cadeia: `getUser` (proxy) → `getUser` (render) → vínculos → MFA (`getClaims` + `getUser`) → **vínculo de novo** (`.single()`, redundante com a lista já carregada) → permissões de ministério → consultas da página. Os passos MFA e permissões não dependem um do outro, mas rodavam em série.
2. **Banco e funções em regiões distantes.** Multiplica o item 1: com ~70 ms por ida e volta, o laboratório deu TTFB de 460 ms só de rede interna.
3. **Rajada de prefetch: 35 requisições por página aberta.** Cada um dos 16 links do menu gera 2 requisições RSC (`/_tree` + segmento), e cada uma passa pelo `proxy.ts`, que faz `getUser()` no Supabase Auth: **35 chamadas ao Auth por página visualizada**, por usuário (trace: `GET /auth/v1/user` ×37 em 4 s após abrir `/agenda`). Isso gera custo de invocação, carga no Auth e disputa de banda no celular.
4. **Nenhum retorno visual na navegação.** Sem `loading.tsx` nem indicador, o clique não muda nada na tela até o servidor terminar (retorno visual p75 = tempo total, 284 ms a 40 ms/chamada).
5. **Imagens de marca sem otimização.** `logo.webp` (171 KB, 960×757) exibida a 220 px na tela de login (candidata a LCP); `emblema.webp` (38 KB, 512×310) exibida a 24–56 px com `priority` em todas as instâncias (preload de cópias ocultas por CSS).

## Itens auditados sem problema relevante
- **Duplicidade de chamadas no mesmo render:** o Next deduplica `fetch` GET idênticos, então `resolveChurchContext` duplicado entre layout e página não dobrava a rede (8 chamadas por documento, 2 ao Auth). Ainda assim memoizamos com `React.cache` para eliminar o trabalho de CPU e o Zod em dobro.
- **N+1:** não encontrado nas rotas medidas (consultas por página em lote ou `Promise.all`, ex.: dashboard).
- **Índices:** as consultas quentes têm índice (`church_memberships(user_id,status)`, `ministry_memberships(church_id,membership_id)`, `notifications(user_id,read_at)`, `events(church_id,starts_at)`). Nenhuma migration necessária.
- **Bundle:** 42 chunks, 362 KB gzip no total do build; a página carrega ~616 KB descomprimidos de JS (React + Next + componentes). Nenhuma dependência pesada no cliente: `qrcode` roda só no servidor, ícones importados por nome. 43 arquivos `"use client"`, todos interativos (formulários, menus).
- **Thread principal:** 0 ms de long tasks durante as navegações e evento de clique ≤ 16 ms (aproximação de INP em laboratório).
- **Fontes:** `@fontsource` servido localmente (`font-display: swap`), sem terceiros.
- **Efeitos/contexto:** apenas 4 arquivos com `useEffect`; sem providers globais de estado.

## Não verificável daqui
Dados de campo (CrUX/Search Console), latência real Vercel↔Supabase e tempo de consulta em produção (o proxy de rede deste ambiente bloqueia o domínio de produção).
