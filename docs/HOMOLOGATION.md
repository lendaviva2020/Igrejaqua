# Homologação e go-live (Gate 7)

Status: **PENDING_REVIEW**. Este documento é o roteiro para colocar a igreja piloto no ar. Nada abaixo foi executado contra serviços reais: o desenvolvimento ocorreu sem acesso ao Supabase hospedado, Vercel, Resend, push, Mercado Pago e getBible. Cada item marcado como "Verificar" precisa de evidência registrada em `docs/GATES/GATE_PROGRESS.md` antes do go-live.

## 1. Pré-requisitos (responsável humano)

| # | Item | Quem | Evidência esperada |
|---|---|---|---|
| 1 | Projeto Supabase criado; região e plano com backup/PITR contratados | Responsável | print do plano; data |
| 2 | Aplicar as **20 migrations** em ordem (`supabase db push` ou SQL Editor) | Responsável | `select count(*) from supabase_migrations.schema_migrations` = 20 |
| 3 | Habilitar `pg_cron` (agendamento da publicação e da retenção) | Responsável | `select * from cron.job` lista `igrejaqua-retention` |
| 4 | Variáveis de ambiente na Vercel (seção 2) | Responsável | `vercel env ls` sem valores impressos |
| 5 | Domínio com HTTPS e `NEXT_PUBLIC_SITE_URL` igual ao domínio final | Responsável | acesso HTTPS ok |
| 6 | Agendar `GET /api/cron/deliver` (a cada 1–5 min) com `Authorization: Bearer $CRON_SECRET` | Responsável | execução registrada nos logs |
| 7 | Parecer jurídico LGPD: texto legal, dado religioso, livro-caixa, contribuições por pessoa | Jurídico | parecer anexado |
| 8 | Se for ligar a IA: parecer sobre transferência internacional (art. 33) + chave e modelo | Jurídico/Responsável | parecer anexado |

## 2. Variáveis de ambiente

Públicas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, identidade pública opcional (`NEXT_PUBLIC_CHURCH_NAME` etc.), `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.

Somente servidor (nunca com prefixo `NEXT_PUBLIC_`): `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `DEEPSEEK_*`.

Canal sem chave fica desligado e nada é enviado (e-mail, push, Pix e IA degradam sem erro).

### 2.1 URLs do Supabase Auth (obrigatório — sem isso os e-mails levam para localhost)
O app envia ao Supabase o endereço de volta correto (`https://<domínio>/callback?...`, ver `src/lib/app-url.ts`), mas o Supabase **só aceita endereços da lista de permitidos**; fora dela, ele usa a **Site URL**. O padrão de projeto novo é `http://localhost:3000`, e era o que estava em produção (2026-11-28: logs do Auth com `referer: http://localhost:3000` mesmo depois da correção do app).

Supabase → **Authentication → URL Configuration**:
- **Site URL**: `https://igrejaqua.vercel.app` (ou o domínio próprio definitivo).
- **Redirect URLs** (adicionar): `https://igrejaqua.vercel.app/**` e, para desenvolvimento, `http://localhost:3000/**`. Previews da Vercel, se forem usados com login: `https://*-felipe-2bc249ac.vercel.app/**`.

Vale para confirmação de cadastro, recuperação de senha e login com Google. Teste: crie uma conta nova e confira se o botão do e-mail abre `https://igrejaqua.vercel.app/...`.

**Aplicado em 2026-11-28 pela Management API:** `site_url = https://igrejaqua.vercel.app` e `uri_allow_list = https://igrejaqua.vercel.app/**,http://localhost:3000/**` (antes: `http://localhost:3000` e lista vazia).

### 2.2 E-mails de autenticação em português
Os modelos (confirmação, senha, link de acesso, convite, troca de e-mail e código) ficam em `tools/supabase/auth-emails.ts` (teste: `tests/unit/auth-emails.test.ts`). Para aplicar:
```
node --experimental-strip-types tools/supabase/auth-emails.ts https://igrejaqua.vercel.app <mailer_otp_exp> > payload.json
curl -X PATCH https://api.supabase.com/v1/projects/<ref>/config/auth -H "Authorization: Bearer <token>" -H "Content-Type: application/json" --data @payload.json
```
**Bloqueio atual:** no plano gratuito com o envio padrão do Supabase, a API recusa a troca de modelos ("Email template modification is not available for free tier projects using the default email provider"). É preciso configurar **SMTP próprio** (Authentication → Emails → SMTP Settings). O envio padrão também limita a **2 e-mails de autenticação por hora para o projeto inteiro** (`rate_limit_email_sent = 2`): insuficiente para cadastros reais.

## 3. Primeiro acesso

1. Criar a conta do pastor/administrador e a igreja (fluxo de cadastro). O administrador é obrigado a ativar o **MFA (TOTP)** no primeiro acesso.
2. Guardar o código de recuperação do autenticador. Se o dispositivo for perdido, a recuperação é manual pelo painel do Supabase (Authentication → Users → remover o fator MFA do usuário), mediante conferência de identidade.
3. Convidar líderes e membros; atribuir `manage_members` ao ministério de acolhimento para famílias e visitantes.
4. Cadastrar categorias financeiras (administração).

## 4. Roteiro de aceite funcional (executar em produção/staging)

- [ ] Login, logout, convite e aceite de convite
- [ ] MFA obrigatório para administrador (ativar, sair, entrar com código)
- [ ] Ministérios, repertório, agenda e escala; notificação de escala chega no app
- [ ] Publicar comunicado/devocional (imediato e agendado); referência bíblica abre `/biblia/...` com atribuição da tradução
- [ ] Pedido de oração (anônimo/identificado conforme regra)
- [ ] Presença/check-in
- [ ] Famílias (menor exige responsável), visitantes (contato só com autorização), células
- [ ] Livro-caixa: lançar, anular, resumo do mês, exportar CSV
- [ ] Pix em **sandbox** do Mercado Pago: gerar, pagar, webhook confirma, aviso ao administrador, estorno total
- [ ] E-mail e push reais: um de cada, com opt-in
- [ ] PWA: instalar e abrir offline (`/offline`)
- [ ] Usuário de outra igreja não enxerga dados (teste manual com duas contas)

## 5. Backup e restauração

- Backup: PITR do Supabase + dump lógico semanal (`pg_dump`, formato custom) para armazenamento criptografado separado.
- **Teste de restauração antes do go-live e trimestralmente**: restaurar em projeto temporário, rodar `select count(*)` nas tabelas principais, abrir o app apontando para ele. Registrar data, duração (RTO medido) e perda de dados (RPO medido).
- Metas (a confirmar com o plano contratado): RPO ≤ 15 min; RTO ≤ 4 h.

## 6. Rollback

- **Aplicação:** promover o deploy anterior na Vercel (instantâneo). O app é compatível com a migration anterior enquanto a nova for apenas aditiva.
- **Banco:** migrations são aditivas; reverter com migration nova (nunca editar uma já aplicada). Dados: restaurar PITR para o instante anterior.

## 7. Operação

| Rotina | Frequência | Observação |
|---|---|---|
| `private.run_retention()` | diária (pg_cron 03:17) | apaga notificações antigas, saída bruta da IA, fila entregue, convites vencidos e contato de visitantes inativos |
| `/api/cron/deliver` | 1–5 min | e-mail/push; 503 se `CRON_SECRET` ausente |
| `/api/cron/repertoire` | diária (ex.: 06:00) | rascunhos de repertório por IA para cultos dos próximos 5 dias; 503 sem `CRON_SECRET`; sem `DEEPSEEK_MODEL` responde sem gerar |
| Revisar `audit_logs` de acesso administrativo | mensal | tabela append-only |
| Teste de restauração | trimestral | seção 5 |
| Rotacionar `CRON_SECRET`, tokens do Mercado Pago e Resend | semestral ou após incidente | atualizar na Vercel e redeploy |

## 8. Incidente de segurança (resumo)

1. Conter: revogar a chave suspeita (Supabase/Mercado Pago/Resend) e rotacionar na Vercel.
2. Avaliar: consultar `audit_logs` e logs da Vercel; identificar titulares afetados.
3. Comunicar: LGPD art. 48 — notificar a ANPD e os titulares em prazo razoável quando houver risco relevante.
4. Corrigir e registrar a lição aprendida em `docs/GATES/GATE_PROGRESS.md`.

## 9. Riscos conhecidos no go-live

- Integrações externas nunca exercitadas de ponta a ponta (ver seção 4 para executá-las em sandbox).
- Tradução bíblica Almeida: confirmar direitos da edição; `livre` é o padrão (CC BY 3.0 BR, com atribuição exibida).
- Pentest, teste de carga e restauração de backup ainda não realizados (Gate 6 parcial).
- Livro-caixa e contribuições por pessoa: revisão LGPD obrigatória antes de produção.
