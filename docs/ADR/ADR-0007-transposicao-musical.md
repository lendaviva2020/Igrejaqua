# ADR-0007 — Arquitetura de transposição musical
Status: PROPOSED
**Decisão:** `song_versions.chordpro` guardado só na tonalidade original; transposição calculada em `lib/music-theory` (função pura, determinística) no servidor e no cliente (Stage offline) com a mesma implementação; `event_setlist.target_key` guarda a tonalidade da sessão.
**Alternativas:** (a) persistir um texto por tom — explosão de dados e divergência; (b) transpor via IA — não determinístico; (c) biblioteca externa — avaliar no Gate 4 se cobre acordes com baixo/extensões, senão implementar com testes de propriedade.
**Trade-offs:** código de teoria musical próprio exige suíte robusta; ganho: fonte única da verdade e offline.
