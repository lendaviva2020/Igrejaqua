# IGREJAQUA — Segurança e Privacidade

Status: **PENDING_REVIEW**

## 1. Autenticação
- Supabase Auth: e-mail+senha e magic link; OAuth Google opcional (Gate 5). MFA TOTP **obrigatório para `admin`** e opcional para demais (Gate 6).
- Política de senha mínima 12 caracteres + verificação de senhas vazadas (HIBP, se habilitado no projeto Supabase).
- Confirmação de e-mail obrigatória. Convites por token de uso único, hash SHA-256 no banco, expiração 7 dias.
- Callback `/callback` valida `next` contra allowlist de caminhos internos (anti open-redirect).

## 2. Sessão
- `@supabase/ssr` com cookies httpOnly/Secure/SameSite=Lax; refresh em `middleware.ts`.
- **Autorização usa `supabase.auth.getUser()` (valida o JWT no Auth server), nunca `getSession()`** do cookie.
- Logout invalida sessão e limpa `iq_church` e caches do service worker.
- Troca de senha/e-mail revoga outras sessões.

## 3. Isolamento de tenant (três camadas)
1. **Servidor:** `resolveChurchContext()` valida vínculo ativo a cada requisição (ARCHITECTURE §4).
2. **Banco:** RLS em toda tabela com `church_id`, usando `private.is_active_member(church_id)`.
3. **Estrutura:** FKs compostas `(church_id, id)` impedem referência cruzada.
Teste obrigatório (Gate 2/6): usuário da igreja A tenta SELECT/INSERT/UPDATE/DELETE em cada tabela com `church_id` da B → zero linhas/erro, automatizado em `supabase/tests` (pgTAP) e `tests/security`.

## 4. RBAC e permissões de ministério
Ver `RBAC.md`. Resumo: papel de igreja (`admin|leader|member`) em `church_memberships` + permissões granulares por ministério em `ministry_permissions`. Autoridade real de `leader` vem das permissões do ministério, não do papel.

## 5. Estratégia de RLS
- RLS **habilitada** (`ENABLE ROW LEVEL SECURITY`) em todas as tabelas de `public`. **Decisão tomada na implementação:** não usamos `FORCE`, porque as funções `SECURITY DEFINER` de `private` leem `church_memberships` como dono da tabela e `FORCE` as sujeitaria à própria RLS (recursão). `anon`/`authenticated` nunca são donos, logo a RLS vale para eles; privilégios de tabela (`GRANT`) são mínimos por papel como defesa em profundidade. Teste SQL garante RLS ativa em 100% das tabelas.
- Política por operação (SELECT/INSERT/UPDATE/DELETE), nunca `FOR ALL` genérica.
- `anon` sem acesso a tabelas de negócio (REVOKE). Único acesso anônimo: páginas de marketing e leitura de `contributions` marcadas como públicas **apenas se** a igreja habilitar (PENDING_REVIEW).
- `WITH CHECK` sempre presente em INSERT/UPDATE e repete a checagem de tenant.
- Funções helper `SECURITY DEFINER`, `SET search_path = ''`, EXECUTE somente para `authenticated`.
- Views com `security_invoker = true`.
- Colunas privadas (`unavailabilities.reason`, autor de oração) protegidas por **separação de tabela/função**, não por política de coluna.
- CI roda `supabase db advisors` (security) e falha em tabelas sem RLS.

## 6. Service role e segredos
- `SUPABASE_SERVICE_ROLE_KEY` e `DEEPSEEK_API_KEY`: apenas variáveis de ambiente do servidor (sem prefixo `NEXT_PUBLIC_`), arquivo `lib/supabase/admin.ts` com `import 'server-only'`.
- Usos permitidos do service role (lista fechada): aceite de convite, job de retenção/anonimização LGPD, gravação de `ai_generation_runs`, rate limiting, **escrita de status/QR de `pix_charges` pelo servidor** (`modules/contributions/provider-writes.ts`, único arquivo permitido do módulo; webhook Mercado Pago validado por HMAC e conferido na API do provedor). Cada uso grava `audit_logs`.
- Teste CI: grep falha se `service_role`/`DEEPSEEK` aparecer em bundle cliente (`.next/static`).
- `.env.example` só com nomes; `gitleaks` no CI; rotação documentada.

## 7. Validação de entrada, autorização de API e rate limiting
- Toda Server Action/Route Handler: Zod `.strict()` → autorização → execução. Resposta de erro padronizada sem vazar detalhes internos.
- Markdown de comunicados/devocionais: sanitização na renderização (allowlist). ChordPro: parser próprio, sem HTML bruto; limite de 64 KB.
- CSRF: Server Actions do Next verificam `Origin`; Route Handlers mutáveis exigem cabeçalho `Origin` válido + SameSite.
- Uploads (avatar, anexos): tipo/magic bytes, limite de tamanho, bucket privado com policies por `church_id` no path.
- Rate limiting (decisão ADR-0006 pendente): **recomendação** tabela `rate_limit_buckets` no Postgres via RPC atômica (sem nova dependência no piloto). Limites iniciais: login 5/min/IP+e-mail, convite 20/h/admin, IA 10/h/usuário e 100/dia/igreja, oração 10/h/usuário. Alternativa: Upstash Redis (menor latência; custo/dependência extra).
- Cabeçalhos: CSP estrita com nonce, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'` (Stage Mode não é embutível).

## 8. Pedidos de oração anônimos
- `prayer_requests` não contém autor. A ligação fica em `prayer_request_authors`, com RLS: **SELECT somente pelo próprio autor**; nenhum papel de leitura geral (nem admin) lê a tabela diretamente.
- Moderação: permissão `manage_content`/papel pastoral vê conteúdo e pode `removed`; **revelar autor** é função `SECURITY DEFINER` separada, exige justificativa, e grava `audit_logs` (visível ao titular em auditoria LGPD). Padrão recomendado: **desabilitada** no piloto (PENDING_REVIEW).
- Anti-correlação: `created_at` do pedido é arredondado para a hora; contagem de interações exibida em faixas se < 5.
- Logs de aplicação nunca registram corpo do pedido nem `user_id` junto a `prayer_request_id`.

## 9. PWA e dados offline
- Service worker: cache de shell/fontes; Stage Mode cacheia **somente** sessões publicadas abertas pelo usuário, com TTL e limpeza no logout.
- Nenhum token ou dado sensível em `localStorage`; IndexedDB só para setlist do Stage.
- Rotas autenticadas com `Cache-Control: private, no-store`.

## 10. Auditoria, retenção, backup
- `audit_logs` append-only (REVOKE UPDATE/DELETE; trigger bloqueia). Registra: papéis/permissões alterados, convites, publicação de escala/conteúdo, uso de IA, exportações, revelação de autor, acessos administrativos a dados pessoais.
- Retenção: ver `DATABASE.md` §7. Job diário de purga com service role e log.
- Backup: Supabase PITR (plano que o suporte) + dump lógico semanal para armazenamento criptografado separado; **teste de restauração trimestral** documentado; RPO ≤ 15 min, RTO ≤ 4 h (metas, PENDING_REVIEW com o plano contratado).

## 11. LGPD
| Requisito | Tratamento |
|---|---|
| Base legal | Execução de contrato/legítimo interesse para gestão; **consentimento** para IA, imagem e dados sensíveis |
| Dado sensível (art. 5º II) | Dados de **convicção religiosa** são sensíveis por natureza: a filiação a uma igreja já o é. Consentimento específico e destacado no cadastro |
| Direitos do titular | `data_subject_requests`: acesso/exportação JSON, correção, eliminação/anonimização, revogação — prazo interno 15 dias |
| Minimização | Campos opcionais; sem CPF no piloto; vocal/instrumento só para ministérios que precisam |
| Menores | Cadastro de menores exige responsável vinculado (Onda 2); Gate 6 define fluxo |
| Encarregado (DPO) | Nomear na igreja; contato no rodapé (PENDING_REVIEW) |
| Incidentes | Runbook de notificação à ANPD/titulares em até 3 dias úteis (recomendação) |
| Transferência internacional | **DeepSeek é operado fora do Brasil** — ver AI_ENGINE §7. Supabase: escolher região `sa-east-1` |
| PIX | Chave PIX pode ser CPF/telefone/e-mail: preferir chave aleatória/CNPJ; aviso ao admin |
| Registro das operações (ROPA) | Documento a produzir no Gate 7 |

## 12. Riscos de segurança abertos
Ver registro em `GATES/GATE_0_ACCEPTANCE.md` (RISK-01…RISK-13). Nenhum controle acima foi **implementado** no Gate 0; tudo é desenho.
