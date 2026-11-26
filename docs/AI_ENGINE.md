# IGREJAQUA — Motor de IA (domínio separado)

Status: **PENDING_REVIEW**. Nada disso está implementado; não há integração falsa.

## 1. Princípios
1. A IA é **consultiva**. Nunca decide segurança, elegibilidade ou publicação.
2. Fluxo obrigatório: `COLETA → GERAÇÃO → VALIDAÇÃO DETERMINÍSTICA → REVISÃO HUMANA → RASCUNHO → PUBLICAÇÃO`. Não existe publicação automática.
3. Chave DeepSeek **somente** no servidor; chamadas só a partir de `src/lib/ai` invocado por Route Handler/Server Action autorizados.
4. Dados pessoais minimizados e pseudonimizados antes de sair do servidor.

## 2. Estrutura
```
src/lib/ai/
  client.ts            # DeepSeek (server-only), timeout, retry com backoff, circuit breaker
  prompts/             # templates versionados (prompt_version)
  collectors/          # montam o contexto mínimo a partir do banco (com RLS do usuário)
  pseudonymize.ts      # mapa efêmero memberId→"M01" (em memória, por execução)
  schemas/             # Zod de entrada e saída por ai_run_kind
  validators/          # camada determinística (§4)
  orchestrator.ts      # executa o pipeline e grava ai_generation_runs
```
Rota: `POST /api/ai/schedule`, `/repertoire`, `/vocal-key`, `/rehearsal-plan`, `/transitions` (ver API_CONTRACTS).

## 3. Capacidades
| Capacidade | Entrada mínima | Saída (Zod) |
|---|---|---|
| Escala inteligente | sessão, funções exigidas, candidatos (token, funções, disponível s/n, contagem recente por função) | `[{function, candidate: "M07", rationale}]` |
| Rotação justa | histórico agregado (contagens), políticas | ajustes sugeridos sobre a escala |
| Sugestão de repertório | tema/escritura, duração alvo, músicas elegíveis (id, título, tom, bpm, tags, última vez usada) | `[{songVersionId, position, reason}]` |
| Tom vocal | faixa do vocalista (notas), extensão da melodia, tom original | **calculado em código** (R-18); a IA apenas explica |
| Plano de ensaio | duração, músicas, nível de dificuldade | blocos de tempo + foco |
| Transições | par de músicas (tons, bpm) | texto sugerido; distância tonal vem do código |

> Onde existe resposta determinística (tom vocal, distância tonal), **o código decide e a IA só redige a justificativa**.

## 4. Camada de validação determinística
Executa após o parse Zod, sobre o banco (com o JWT do usuário solicitante):

| Verificação | Regra |
|---|---|
| Existência do membro | token resolve para `membership` real |
| Vínculo com a igreja | `church_id` da sessão = da membership, status ativo (R-03) |
| Elegibilidade no ministério | `ministry_memberships` ativo e função compatível (R-09) |
| Disponibilidade | sem `unavailabilities` conflitante (R-10) |
| Duplicidade | sem lineup repetido/sobreposto (R-07, R-08) |
| Rotação | limites R-13/R-14 |
| Existência de música | `song_version_id` pertence à igreja, `status=published` |
| Consistência do evento | sessão existe, não cancelada, não passada |
| Tamanho/forma | arrays ≤ limites; sem campos extras (`.strict()`) |

Resultado: `validation_report` com `ok`, `violations[]` (código da regra, severidade). Itens inválidos **são removidos ou marcados**, nunca "consertados" pelo LLM. Se `violations` bloqueantes > 0, `status=validation_failed` e nada vira rascunho. Uma segunda tentativa automática (1x) pode reenviar apenas as violações.

## 5. Estados de `ai_generation_runs`
`pending → generated → (validation_failed | validated) → (accepted | discarded)`; `error` em falha de rede/formato. `accepted` cria `event_lineup` em **draft** com `source='ai'` e `ai_run_id`. Publicar continua exigindo `publish_schedule`.

## 6. Minimização de dados enviados à DeepSeek
**Nunca enviar:** nome, e-mail, telefone, endereço, foto, CPF, motivo de indisponibilidade, texto de oração, `church_id`/`user_id` reais.
**Enviar:** tokens efêmeros (`M01…`), funções, booleano de disponibilidade, contagens agregadas, ids de música *substituídos por índices* (mapeados de volta no servidor), tons, bpm, títulos de música (conteúdo público) — títulos podem ser trocados por índice se a igreja optar.
Controles: `church_settings.ai_enabled` (padrão **false**), consentimento registrado em `consent_records`, `input_digest` (hash) em vez de payload gravado, `raw_output` sem identificadores, limite de tokens, sem treinamento sobre dados (verificar e registrar os termos vigentes da API — PENDING_REVIEW).

## 7. Riscos específicos
| Risco | Mitigação |
|---|---|
| **Transferência internacional (LGPD art. 33)**: provedor fora do Brasil | pseudonimização forte + consentimento + parecer jurídico antes do Gate 5; alternativa: provedor com região no Brasil / modelo hospedado |
| Alucinação de membro/música | validação determinística; ids nunca confiados |
| Prompt injection via títulos/notas | conteúdo do usuário sempre em campo de dados delimitado; saída só aceita via schema; nenhuma ferramenta/ação executada pelo LLM |
| Custo/abuso | rate limit por usuário/igreja, teto de tokens, orçamento mensal por igreja |
| Indisponibilidade da API | timeout, circuit breaker, o produto funciona 100% sem IA (escala manual) |
| Viés de rotação | métricas de justiça calculadas em código e exibidas na revisão |

## 8. API DeepSeek
Usar a API oficial (documentação em api-docs.deepseek.com), compatível com SDK estilo OpenAI. **Nomes de modelo, URL-base, limites e preços não foram verificados neste Gate** (PENDING_REVIEW); ficam em `config/ai.ts` + variáveis de ambiente e são confirmados no Gate 5 com chamada real de homologação.

## Classificação
Arquitetura: PENDING_REVIEW · Implementação: NOT_IMPLEMENTED · Parecer LGPD de transferência: BLOCKED (para ativar IA em produção).
