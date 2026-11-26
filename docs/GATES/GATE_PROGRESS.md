# Progresso dos Gates — evidências

Data: 2026-11-25. Ambiente: Node 22, Postgres 16 local (sem Supabase hospedado), Google Chrome para E2E.
Regra do projeto: **só é "feito" o que tem evidência abaixo.**

## Decisões assumidas por "Executar tudo" (requerem confirmação)
1. Escopo em duas ondas; **Onda 2 (ledger financeiro, famílias, visitantes, células) não implementada**.
2. Contexto de igreja por cookie revalidado (ADR-0003).
3. IA **desligada por padrão**; nenhuma chamada à DeepSeek foi implementada nem executada. Ativar exige parecer jurídico (transferência internacional + dado religioso).

## Evidência (última execução)
```
typecheck (tsc 6.0.3)         OK
lint (eslint 9, next+ts)      OK
build (next 16.4.6)           Compiled successfully; Proxy (Middleware) reconhecido
vitest                        6 arquivos / 70 testes passaram
testes SQL (Postgres 16)      TODOS OS TESTES SQL PASSARAM  (RLS, isolamento, regras de escala, oração, auditoria)
playwright (Chrome, mobile+desktop)  12 passed
```
Teste de mutação da RLS: três políticas foram enfraquecidas de propósito (leitura do autor de oração, leitura de ministérios, visibilidade de rascunho); a suíte falhou nas três. Uma lacuna foi encontrada (rascunho de escala visível a outros membros não era testado) e corrigida com teste novo.

## Estado por Gate
| Gate | Estado | O que existe (com evidência) | O que NÃO existe |
|---|---|---|---|
| 1 Design System | PARCIAL | tokens (cor/tipografia/espaço), Button, FormField, PageHeader, EmptyState, ChordSheet, Stage; contrastes calculados | rota `/design`, Storybook, aprovação do Designer humano, axe automatizado |
| 2 Banco/Auth/RLS | **IMPLEMENTADO localmente** | 7 migrations, RLS em todas as tabelas, FKs compostas, triggers (R-07..R-11), auditoria append-only, funções de convite/igreja/oração/música; suíte SQL | **não aplicado a nenhum projeto Supabase real**; fluxo de Auth real (e-mail, convite por e-mail, magic link) nunca executado; tipos gerados; pgTAP |
| 3 Navegação | PARCIAL | proxy (sessão, CSP com nonce, redirect), shell por papel, seleção/criação de igreja, convite por código | rotas de agenda, escalas, disponibilidade, comunidade, notificações, configurações |
| 4 Módulos | PARCIAL | ministérios (listar/criar), repertório (listar/criar/ver), transposição, Stage por versão de música, painel com agenda e "minha escala" | membros e convites (UI admin), permissões de ministério (UI), eventos/sessões (UI), escalas (UI), setlist por sessão, RSVP, presença, comunicados, oração (UI), PIX, notificações |
| 5 Integrações | PARCIAL (bibliotecas) | schema Zod da saída de IA, pseudonimização, validador determinístico (R-07..R-14), parser ChordPro, teoria musical, rate limit | cliente DeepSeek, rotas `/api/ai/*`, jobs/cron, Web Push, e-mail, BR Code PIX, MFA, service worker/offline |
| 6 Testes/Segurança | PARCIAL | testes acima; varredura de segredos no bundle; headers | pentest, carga, auditoria WCAG completa (axe), restauração de backup |
| 7 Homologação | NOT_IMPLEMENTED | — | tudo |

## Bugs reais encontrados e corrigidos durante a execução
1. CSP com nonce deixava páginas estáticas sem JavaScript → `await connection()` no layout raiz + E2E de hidratação.
2. `typescript-eslint` incompatível com TS 7 → TS 6.0.3.
3. Testes de negação baseados em erro falhavam onde a RLS filtra linhas (0 linhas, sem erro) → testes passaram a afirmar contagem 0.
4. Lacuna de teste de visibilidade de rascunho (detectada por mutação).

## Bloqueios externos
- **Push para GitHub:** o repositório `lendaviva2020/igrejaqua` não está acessível nesta sessão (lista de repositórios vazia; token inválido). Commits existem apenas localmente.
