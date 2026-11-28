# Ambiente de teste isolado (E2E autenticado)

Objetivo: exercitar o app **logado**, de ponta a ponta, sem Supabase hospedado e **sem tocar em produção**. Tudo vive em `tools/e2e-stack/` e roda localmente.

## O que sobe
| Peça | Origem | Observação |
|---|---|---|
| Postgres 16, banco `iq_e2e` | local | recriado a cada `stack:up`; recebe **todas** as migrations em ordem |
| PostgREST 12.2.3 | binário oficial (GitHub Releases) | a RLS do banco é exercida de verdade |
| Gateway + login de teste (`server.ts`) | este repositório | JWT HS256 com o mesmo segredo do PostgREST; senha (scrypt) e MFA TOTP (RFC 6238). **Não é o GoTrue**: serve para provar o app, não o provedor |
| Dados de teste (`seed.ts`) | este repositório | pessoas e registros rotulados "de Teste"; só nesse banco |

`db-setup.sql` reproduz os **privilégios padrão do Supabase** (`ALTER DEFAULT PRIVILEGES … GRANT ALL`), para que nenhuma proteção dependa de falta de permissão.

## Como rodar
1. Postgres local com superusuário (`PGHOST`, `PGPORT`, `PGUSER`) e o binário em `/tmp/stack/bin/postgrest` com `postgrest.conf` (modelo em `tools/e2e-stack/postgrest.conf.example`).
2. `npm run stack:up` — recria banco, sobe PostgREST e gateway, semeia.
3. Build do app apontando para o gateway: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54400`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…`, `SUPABASE_SERVICE_ROLE_KEY=$(curl -s localhost:54400/keys | jq -r .service_role)`, `NEXT_PUBLIC_SITE_URL=http://localhost:3160`; depois `next start -p 3160`.
4. `npm run test:stack` — login (admin com MFA obrigatório, líder, membro) e passeio por todas as telas em 3 tamanhos (celular 390, tablet 820, desktop 1440). Capturas em `.stack/shots/` (ignorado pelo git).

## O que o passeio verifica
HTTP < 400, ausência de erro de página/console e de resposta 5xx, **ausência de rolagem horizontal**, e as barreiras de acesso (membro/líder recebem 404 onde não têm poder).

## Limites
- O servidor de login é um substituto: confirmar login, MFA, recuperação de senha e e-mails no **Supabase Auth real** continua obrigatório (ver `docs/HOMOLOGATION.md`).
- Serviços externos (getBible, Resend, push, Mercado Pago, DeepSeek) não são exercitados aqui.

## Benchmark de navegação (Gate P0)
Com a pilha no ar: `IQ_PERF_LATENCY_MS=40 node --experimental-strip-types tools/perf/latency-proxy.ts` (proxy em `:54402` que injeta latência e conta as chamadas ao backend). Faça o build do app com `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54402`, rode `next start -p 3160` e depois `IQ_PERF_LABEL=<nome> npm run perf:bench`. O resultado vai para `.stack/perf/<nome>.json`. `IQ_PERF_BROWSER_RTT_MS` emula o RTT do navegador. Metodologia e números: `docs/performance/`.
