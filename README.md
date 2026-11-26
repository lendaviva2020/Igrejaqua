# IGREJAQUA

Plataforma de gestão de igreja, ministérios, escalas e repertório (multi-igreja).
Leia `docs/ARCHITECTURE.md` e `docs/GATES/GATE_PROGRESS.md` para o estado real.

## Rodar
```bash
cp .env.example .env.local      # preencha as chaves do Supabase (service role e DeepSeek: somente servidor)
npm install
npm run dev
```
## Verificações
```bash
npm run check                  # tsc + eslint + vitest
npm run test:sql               # aplica migrations num Postgres local descartável e roda a suíte de RLS
IQ_E2E_CHROME=/caminho/do/chrome npm run test:e2e   # após `npm run build`
```
`test:sql` usa as variáveis padrão do `psql` (PGHOST/PGPORT/PGUSER) e um shim mínimo do schema `auth` do Supabase.
