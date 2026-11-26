# IGREJAQUA — Regras de Domínio

Status: **PENDING_REVIEW**. Cada regra tem ID para rastrear em testes (`tests/unit/domain/R-XX.test.ts`) e no validador de IA.

## Identidade e igreja
- **R-01** Um usuário (`profiles`) pode ter vínculo com N igrejas; no máximo um vínculo por (igreja, usuário).
- **R-02** Toda igreja tem ao menos um `admin` ativo e um `owner`. Operações que violem isso são rejeitadas (servidor e trigger).
- **R-03** Membro só acessa uma igreja quando `status='active'`.

## Ministérios
- **R-04** Um membro de ministério precisa ter vínculo ativo com a mesma igreja do ministério.
- **R-05** Permissões de ministério só existem para `ministry_memberships` ativos.

## Eventos, sessões e escala
- **R-06** Um evento tem 1..N sessões independentes (ex.: ensaio 19h e culto 20h30). Escala, setlist, RSVP e presença pertencem à **sessão**, não ao evento. Ver ADR-0008.
- **R-07** Uma pessoa não pode estar escalada (status `draft|published|confirmed`) em duas sessões cujos intervalos se sobrepõem, **exceto** com intervalo ≥ buffer configurável quando permitido por `church_settings.rotation_policy.allow_back_to_back`.
- **R-08** Uma mesma pessoa pode ter mais de uma `function` na mesma sessão apenas se `rotation_policy.allow_multi_function` = true.
- **R-09** Escalar alguém exige: vínculo ativo na igreja, membro ativo do ministério, função compatível com `instruments`/`voice_part`, e **não** estar indisponível na data (R-10).
- **R-10** Indisponibilidade cobre `daterange` (+ dias da semana opcionais). Escalar em período indisponível é bloqueado; admin pode forçar com justificativa auditada (`source='manual'`, `override_reason`).
- **R-11** Estados de escala: `draft → published → confirmed|declined`; `declined → replaced`; qualquer → `cancelled`. Apenas `publish_schedule` publica. Transições inválidas são rejeitadas.
- **R-12** Recusa/ausência dispara notificação ao líder e abre sugestão de substituto (IA opcional, com revisão humana).
- **R-13** **Rotação justa:** em janela configurável (padrão 8 semanas), a diferença entre o membro mais e o menos escalado por função não deve exceder `rotation_policy.max_gap` (padrão 2), salvo indisponibilidades. Peso por tipo de evento (culto > ensaio).
- **R-14** Máximo de escalas por pessoa por mês (`rotation_policy.max_per_month`, padrão 4).
- **R-15** Escala só é publicável com todas as funções obrigatórias do modelo do evento preenchidas ou com aviso explícito assinado pelo líder.

## Repertório e música
- **R-16** `song_versions.chordpro` está sempre armazenado na **tonalidade original** (`original_key`); a transposição é cálculo, nunca persistência de texto (ADR-0007).
- **R-17** `event_setlist.target_key` guarda a tonalidade desejada para aquela sessão; o texto exibido = `transpose(chordpro, semitones(original_key → target_key))`. Notação preferida (sustenido/bemol) segue a tonalidade-alvo.
- **R-18** Recomendação de tom vocal: dado `vocal_range` do vocalista principal e extensão da melodia da versão (`melody_low/high` opcional), escolher tom que mantenha a melodia dentro de [low+1, high−1] semitons; se inexistente, listar a menor transposição que minimiza violações.
- **R-19** Setlist: `position` única por sessão; mesma versão não pode se repetir na sessão.
- **R-20** Transições: o par (música i, música i+1) tem distância tonal calculada pelo círculo de quintas; a IA pode sugerir ponte, mas a distância e a validade da tonalidade vêm do código.
- **R-21** Música com `copyright_notice`/`ccli_number` exibe aviso no Stage Mode e relatórios de uso (obrigação de licenciamento é responsabilidade da igreja — PENDING_REVIEW).

## Comunicação e comunidade
- **R-22** Comunicado `scheduled` é publicado por job idempotente em `publish_at`; sem `publish_schedule`/`manage_content` não publica.
- **R-23** Audiência `ministry` só é visível a membros do ministério.
- **R-24** Pedido anônimo não expõe autor a nenhum papel (SECURITY §8). Pedidos `removed` não aparecem a membros.
- **R-25** RSVP: uma resposta por (sessão, membro); editável até o fim da sessão.
- **R-26** Presença: `unique (session, membership)`; self check-in permitido na janela [início−60 min, fim].

## PIX
- **R-27** `contributions` é informativa. O sistema **não** processa pagamentos, não coleta valor nem identifica pagador. O BR Code estático é gerado no servidor conforme o manual do BCB (a validar com biblioteca/implementação testada contra o validador oficial — NOT_IMPLEMENTED).

## Tempo
- **R-28** Todas as comparações de data usam `timestamptz`; regras de "dia" usam `churches.timezone`. Horário de verão não deve alterar sessões já criadas.
