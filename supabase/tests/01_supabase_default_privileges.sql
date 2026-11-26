-- SOMENTE TESTE: reproduz os privilégios padrão do Supabase em objetos novos do schema public
-- (ALTER DEFAULT PRIVILEGES ... GRANT ALL TO anon, authenticated, service_role). Ative com IQ_SUPABASE_DEFAULT_PRIVS=1.
-- Garante que nenhuma proteção dependa da AUSÊNCIA de permissão: o que importa é RLS, REVOKE explícito e gatilhos.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
