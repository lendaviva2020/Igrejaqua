# Progresso dos Gates — evidências

Data: 2026-11-25. Ambiente: Node 22, Postgres 16 local (sem Supabase hospedado), Google Chrome para E2E.
Regra do projeto: **só é "feito" o que tem evidência abaixo.**

## Decisões assumidas por "Executar tudo" (requerem confirmação)
1. Escopo em duas ondas; **Onda 2 (livro-caixa, famílias, visitantes, células) implementada em 2026-11-26** (ver seção própria).
2. Contexto de igreja por cookie revalidado (ADR-0003).
3. IA **desligada por padrão**; nenhuma chamada à DeepSeek foi implementada nem executada. Ativar exige parecer jurídico (transferência internacional + dado religioso).

## Evidência (última execução — 2026-11-26)
```
typecheck (tsc)               OK
lint (eslint)                 OK
build (next 16)               OK (Proxy reconhecido; /api/cron/deliver e /mfa compilados)
vitest                        20 arquivos / 171 testes passaram
testes SQL (Postgres 16)      TODOS OS TESTES SQL PASSARAM (RLS, regras, IA, retenção, fila de entrega, inscrição de push)
playwright (Chrome)           46 passed (mobile+desktop)
web-push                      par VAPID gerado e aceito; assunto inválido recusado (execução real da biblioteca)
```
Mutação da RLS (rodada anterior): três políticas enfraquecidas de propósito, suíte falhou nas três; uma lacuna encontrada e corrigida.
**Nada foi exercitado contra Supabase hospedado, DeepSeek, Resend, Mercado Pago ou serviço de push real.**

## Estado por Gate
| Gate | Estado | Implementado (com evidência) | Pendente / bloqueado |
|---|---|---|---|
| 1 Design System | IMPLEMENTADO | tokens "Noite & Âmbar", componentes base, Stage Mode, axe automatizado (E2E) | aprovação do designer humano |
| 2 Banco/Auth/RLS | IMPLEMENTADO localmente | 17 migrations, RLS em todas as tabelas, FKs compostas, triggers, auditoria append-only, suíte SQL | aplicar em Supabase real; fluxo de Auth real; tipos gerados |
| 3 Navegação | IMPLEMENTADO | proxy (sessão, CSP nonce), shell por papel, seleção de igreja, convites | — |
| 4 Módulos | IMPLEMENTADO | ministérios, repertório, agenda/escalas, membros/convites, presença, comunicados, oração, notificações, configurações/LGPD, publicação agendada, contribuições Pix | revisão LGPD do livro-caixa |
| 5 Integrações | IMPLEMENTADO (código e testes locais) | motor de IA consultiva (escala), PWA/offline, retenção de dados (`private.run_retention`), fila de e-mail (Resend) e Web Push (VAPID) com worker `/api/cron/deliver`, MFA TOTP para admin | chamadas reais (DeepSeek, Resend, push); parecer jurídico (LGPD art. 33) antes de ligar a IA; demais capacidades de IA (repertório, tom vocal, ensaio, transições); agendar o worker e `pg_cron` |
| 6 Testes/Segurança | PARCIAL | testes acima, varredura de segredos no bundle, headers, axe | pentest, carga, restauração de backup |
| 7 Homologação | ROTEIRO PRONTO | `docs/HOMOLOGATION.md` (pré-requisitos, aceite funcional, backup/restauração, rollback, operação, incidente) | executar o roteiro em ambiente real; teste de restauração; pareceres jurídicos |

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
- Pendente: revisão LGPD do dado financeiro por pessoa; validar o estorno no sandbox do Mercado Pago.

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

## Publicação agendada (Gate 4)
- Comunicados/devocionais: "Agendar" (data/hora no fuso da igreja → UTC no cliente, validado no servidor: 1 min a 1 ano à frente). Rascunho agendado pode ser publicado na hora ou voltar a rascunho.
- Publicação no banco (`private.publish_due_content`, migration `…001300`): `pg_cron` a cada minuto quando a extensão estiver habilitada (Supabase: Database → Extensions → pg_cron) e, como complemento, `public.publish_due_content(church)` ao abrir /comunicados. As notificações saem pelas triggers existentes. Sem service role e sem endpoint HTTP.
- Pendência de ambiente: habilitar `pg_cron` no projeto real e conferir `select * from cron.job`.
- Evidência: tsc, eslint, build, vitest (126), Playwright (22), SQL (vencido publica, futuro não, visibilidade, isolamento, notificação).

## Preferências de notificação (Gate 4)
- `/notificacoes`: chaves por categoria (escala, comunicado, devocional) para o canal "dentro do sistema". Sem registro = ligado; `private.notify` já respeita a preferência. Push e e-mail seguem sem envio (sem provedor), e a tela diz isso.
- Evidência: tsc, eslint, build, vitest (128), Playwright (22), SQL (upsert sem duplicar, isolamento por titular e por igreja).

### Acessibilidade automatizada (axe)
- `tests/e2e/a11y.spec.ts`: axe (WCAG 2.0/2.1 A e AA) em `/`, `/login`, `/cadastro`, `/recuperar-senha`, `/privacidade` e `/termos`, em desktop e mobile. Resultado: 12/12 sem violações.
- Limite: axe cobre só parte dos critérios; faltam telas autenticadas (exigem Supabase real) e revisão manual com leitor de tela.

### PWA e offline
- `public/manifest.json` com ícones 192/512 e maskable (`public/icons`), `public/sw.js` (registrado só em produção por `ServiceWorkerRegister`).
- Cache restrito (SECURITY §9): `/_next/static`, `/icons`, página `/offline` e páginas `/palco/<uuid>` já abertas (network-first, máx. 30, nunca resposta redirecionada/erro). Demais rotas autenticadas não são cacheadas.
- Logout (`SignOutForm`) envia `CLEAR_CACHES` ao service worker; o `sw.js` é servido com `no-cache`.
- Testes E2E (`tests/e2e/pwa.spec.ts`): manifest/ícones, cabeçalho do sw, fallback offline, rotas protegidas fora do cache, limpeza de caches. Total E2E: 42 passando.
- Limite: o cache do Modo Palco offline não foi exercitado com sessão real (depende do Supabase); push notifications não implementado.

### Motor de IA — escala consultiva
- Migrations `20261126001400_ai_engine.sql` e `20261126001500_ai_consent.sql`; pgTAP/SQL ampliado (execução, aceite só validado, rascunho `draft/source=ai`, sem escrita direta, consentimento, revogação, isolamento entre igrejas).
- Pipeline `src/lib/ai/*`, rotas `/api/ai/schedule` e `/api/ai/runs/[runId]`, ativação em Configurações (admin) e painel "Sugestão por IA" na sessão (só com IA ativa, configurada e permissão `schedule.edit`).
- Testes: 147+ unitários (cliente com retry/disjuntor/truncamento, pseudonimização sem vazamento, rotação, injeção, validação) e guarda E2E das rotas.
- Limites: sem chamada real ao provedor (chave e modelo pendentes); parecer jurídico LGPD pendente antes de usar em produção.

## Passo 5 — retenção, entrega (e-mail/push) e MFA
- **Retenção**: `private.run_retention()` (notificações lidas 180 d / não lidas 365 d, saída bruta de IA 90 d, entregas 90 d, rate limits 2 d, idempotência 7 d, convites vencidos); sobrescrita por igreja em `church_settings.retention_policy`; `audit_logs` nunca é apagado; agendado por `pg_cron` às 03:17 apenas se a extensão existir. Testado na suíte SQL.
- **Fila de entrega**: tabela `notification_deliveries` + trigger de enfileiramento (e-mail só com opt-in explícito; push só com inscrição ativa e sem opt-out); `claim_notification_deliveries` (`SKIP LOCKED`, reabre "sending" > 5 min), `complete_notification_delivery` (backoff 1/2/4/8 min, falha final na 5ª tentativa), `drop_push_subscription`; todas restritas a `service_role`. `save_push_subscription`/`remove_push_subscription` para o usuário (aparelho compartilhado: o último a entrar assume o endpoint).
- **Worker**: `GET|POST /api/cron/deliver` com `Authorization: Bearer $CRON_SECRET` (tempo constante; 503 sem segredo). Canal sem configuração é marcado `skipped`, nunca como enviado. **Agendamento é externo** (Vercel Cron/Schedules ou `pg_cron`+`pg_net` chamando a rota a cada minuto); não há `vercel.json` assumido.
- **Departure da lista fechada de service role**: `src/modules/notifications/delivery-store.ts` foi adicionado (ESLint + SECURITY §6); só chama as 3 funções SQL da fila.
- **Falha real encontrada por teste**: links `//host` passavam no filtro de "caminho interno" (e abririam site externo no clique do push) → regex agora exige `/` seguido de não-`/` em e-mail, payload e service worker.
- **MFA**: TOTP via Supabase Auth; admin com fator cadastrado precisa estar em aal2 (`resolveChurchContext` redireciona para `/mfa`); admin sem fator é redirecionado a `/mfa/configurar` (obrigatório, decisão do responsável em 2026-11-26). Não verificável sem Supabase real (QR, challenge e unenroll aal2 dependem do servidor).
- **Observabilidade**: apenas registros de execução da IA (`ai_generation_runs`), `audit_logs` e `console.error` estruturado no worker; sem APM/alertas.

## Bíblia (leitura) e MFA obrigatório — 2026-11-26
- **Fonte**: getBible API v2 (`api.getbible.net/v2`), gratuita, sem chave, JSON estático por capítulo. Padrão: **Bíblia Livre** (CC BY 3.0 Brasil — exige atribuição, exibida no rodapé). Opção: **Almeida Atualizada** (módulo CrossWire distribuído sob GPL; **confirmar direitos da edição** antes de uso público amplo). Formato e lista de traduções conferidos nos endpoints reais pela ferramenta de busca; **o servidor de testes não tem acesso à internet**, então a chamada ao vivo ocorre só em produção (erro tratado na tela, com "Tentar de novo").
- Busca server-side com cache de 30 dias, timeout de 8 s, allowlist de tradução e validação Zod (capítulo/livro devem bater). Telas `/biblia` (livros + "Ir para" com parser de referências) e `/biblia/[livro]/[capitulo]` (destaque de versículos, navegação, atribuição).
- MFA: admin sem autenticador → `/mfa/configurar` (obrigatório); com autenticador em aal1 → `/mfa`.
- Vercel: o conector não lista o projeto IGREJAQUA nesta conta (só `eletricai`); configuração de variáveis feita pelo responsável.

## Onda 2 — famílias, visitantes, células, financeiro e leitura do dia — 2026-11-26

- Migration `20261126001800` + `supabase/tests/110_wave2.sql` (RLS, menores, consentimento de visitantes, imutabilidade do livro-caixa, auditoria sem valores).
- Rotas protegidas: `/familias`, `/visitantes`, `/celulas`, `/celulas/[cellId]`, `/financeiro` (E2E de guarda → login).
- Capacidades novas em `capabilities.ts`: `family.view`, `family.manage`, `visitor.manage`, `visitor.delete`, `cell.manage`, `finance.manage`; testes em `tests/unit/wave2-schemas.test.ts` e `finance-money.test.ts`.
- Bíblia integrada a comunicados/devocionais (`ScriptureLink`) e "Leitura do dia" no painel (referência do último devocional publicado; nenhum versículo inventado).
- Pendências: revisão LGPD do livro-caixa; nada foi exercitado contra serviços reais (Supabase/Resend/push/getBible) no sandbox.

- Exportação CSV mensal do livro-caixa (`/financeiro/exportar?m=AAAA-MM`, só administração, anti-injeção de fórmula; `tests/unit/finance-csv.test.ts`).
- Retenção de contato de visitantes (migration `20261126001900`, 365 dias por padrão) com teste em `110_wave2.sql`; 19 migrations.
- Aviso à administração quando um Pix é confirmado (migration `20261126002000`, categoria `contribuicao`; não identifica o contribuinte; dedupe por cobrança). 20 migrations.
- Estorno total de Pix pela administração (`refundChargeAction` → `POST /v1/payments/{id}/refunds` com idempotência; status local só muda após reconsulta do provedor). Testado só com `fetch` simulado (`tests/unit/pix-payments.test.ts`).
