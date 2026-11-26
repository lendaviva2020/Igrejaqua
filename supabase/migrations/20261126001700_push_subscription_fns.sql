-- Inscrições de push pertencem ao navegador: em aparelho compartilhado, quem entra por último assume o endpoint.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_ua_hash text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'não autenticado' using errcode = '42501'; end if;
  if p_endpoint !~ '^https://[^[:space:]]+$' or char_length(p_endpoint) not between 20 and 500 or char_length(p_p256dh) not between 20 and 200 or char_length(p_auth) not between 8 and 100 then
    raise exception 'inscrição inválida' using errcode = '22023';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_secret, user_agent_hash)
    values (v_actor, p_endpoint, p_p256dh, p_auth, left(p_ua_hash, 64))
    on conflict (endpoint) do update set user_id = v_actor, p256dh = excluded.p256dh, auth_secret = excluded.auth_secret, user_agent_hash = excluded.user_agent_hash;
end $$;

-- Remove a inscrição deste navegador do usuário atual (logout ou "desativar").
create or replace function public.remove_push_subscription(p_endpoint text) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = (select auth.uid());
$$;

revoke all on function public.save_push_subscription(text, text, text, text), public.remove_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text), public.remove_push_subscription(text) to authenticated;
