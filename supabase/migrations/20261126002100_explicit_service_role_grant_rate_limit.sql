-- O limitador de tentativas (/login, Pix, IA…) é chamado pelo servidor com a service role.
-- A migration 0005 revoga a função de public/anon/authenticated e dependia dos privilégios padrão do Supabase para a service_role.
-- Torna o acesso explícito: nenhuma função sensível pode depender de configuração implícita da plataforma.
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
