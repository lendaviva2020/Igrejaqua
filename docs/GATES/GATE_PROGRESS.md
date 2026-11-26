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

## Atualização — Pix via Mercado Pago (Gate 4/5)
- Implementado: `pix_charges` (RLS: pagador + admin; cliente só cria intenção), cliente Mercado Pago (`POST /v1/payments`, `X-Idempotency-Key`, expiração -03:00), webhook `/api/webhooks/mercadopago` (HMAC-SHA256 do manifesto `id;request-id;ts`, comparação em tempo constante; status relido na API do provedor; confere `external_reference` e valor), páginas `/contribuir` e `/contribuir/[chargeId]` (QR em SVG, copia e cola, verificação automática).
- **Não verificado contra o provedor real**: sem chaves, só testado com `fetch` simulado e testes SQL. Pendente: configurar `MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_WEBHOOK_SECRET`, cadastrar a URL do webhook no painel e testar em sandbox antes de produção.
- Pendente: revisão LGPD do dado financeiro por pessoa; conciliação/relatório exportável; estorno pelo app; notificação ao administrador.

## Membros e convites (Gate 4)
- `/membros` (somente admin): gerar convite (token de 256 bits; só o hash sha256 é gravado; link exibido uma única vez, válido 7 dias), revogar, alterar papel e suspender/reativar. Regras de proteção (não alterar o próprio papel, último admin) permanecem no banco (`memberships_guard`).
- Aceite: `/selecionar-igreja?convite=<token>` (agora fora do layout `(app)` para evitar loop de redirecionamento de quem ainda não tem igreja); o login preserva a query string via `safeNextPath`.
- Limitação: não há envio de e-mail; o admin compartilha o link manualmente.
- Evidência: tsc, eslint, vitest (98 ok), build, Playwright (18), SQL (convites: autorização, cross-tenant, revogação, expiração).

## Landing, autenticação e integrantes de ministério (Gate 4)
- Landing (`/`), `/privacidade` e `/termos` públicas, sem números, depoimentos ou capturas fictícias. Redes sociais, e-mail de contato e nome da igreja aparecem no rodapé/landing só quando as variáveis `NEXT_PUBLIC_*` (ver `.env.example`) estiverem definidas.
- Tipografia: Merriweather (títulos) + Source Sans 3 (texto), auto-hospedadas (@fontsource), sem chamadas ao Google.
- Auth completa: login, cadastro, esqueci a senha → `/callback` → `/redefinir-senha` (encerra outras sessões), sair, e "Continuar com o Google" (escopos `openid email profile`; só aparece com `NEXT_PUBLIC_AUTH_GOOGLE=true` depois de habilitar o provedor no Supabase e cadastrar `<SITE_URL>/callback` como redirect).
- `/ministerios/[id]`: adicionar/editar/remover integrantes (função, instrumentos, naipe, ativo) e conceder/revogar permissões (anti-escalada no banco).
- Textos legais são versão inicial para a igreja piloto; validação jurídica pendente.
- Evidência: tsc, eslint, build, vitest (116), Playwright (22), SQL (integrantes, convites).

## Configurações e LGPD do titular (Gate 4)
- `/configuracoes`: perfil próprio (nome, como prefere ser chamado, telefone), troca de senha (encerra outras sessões), "Baixar meus dados" (`/api/me/export`, JSON lido com a sessão do titular via RLS; pedidos de oração ficam de fora para preservar o anonimato), pedido formal ao titular (acesso, correção, eliminação, portabilidade, revogação; prazo de 15 dias no banco).
- Administração: dados da igreja (nome, razão social, CNPJ, fuso) e caixa de pedidos de titulares (iniciar, concluir, recusar). A execução da eliminação/anonimização em si continua manual, conforme DATABASE.md, até haver procedimento validado juridicamente.
- Evidência: tsc, eslint, build, vitest (119), Playwright (22), SQL (pedidos, perfil, renomear igreja).

## Presença / check-in (Gate 4)
- Na página do evento, cada sessão tem o painel "Presença": "Estou aqui" (check-in próprio, só na janela R-26: 60 min antes do início até o fim, imposta por `private.attendance_guard`, migration `…001200`), e para quem tem `manage_schedule`: lista de presentes, registro manual por liderança e remoção.
- Membro comum só enxerga a própria presença (RLS). Pessoas com vínculo não ativo não podem ser registradas.
- Evidência: tsc, eslint, build, vitest, Playwright, SQL (janela, duplicidade, impersonação, permissões, isolamento).
