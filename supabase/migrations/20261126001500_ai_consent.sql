-- Ativação da IA por igreja (docs/AI_ENGINE.md §6): somente admin, sempre com registro de consentimento (LGPD).
-- Padrão continua desligado. Desativar revoga o consentimento e também é registrado.
create or replace function public.set_church_ai(p_church uuid, p_enabled boolean, p_consent_version text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'não autenticado' using errcode = '42501'; end if;
  if not private.has_church_role(p_church, array['admin']::public.membership_role[]) then
    raise exception 'apenas a administração altera o uso de IA' using errcode = '42501';
  end if;
  if p_consent_version is null or char_length(p_consent_version) not between 1 and 40 then
    raise exception 'versão do termo inválida' using errcode = '22023';
  end if;
  update public.church_settings
     set ai_enabled = p_enabled,
         ai_data_sharing_consent_at = case when p_enabled then now() else null end
   where church_id = p_church;
  if not found then raise exception 'configuração da igreja não encontrada' using errcode = 'P0002'; end if;
  insert into public.consent_records (user_id, church_id, purpose, version, granted)
    values (v_actor, p_church, 'ai_data_sharing', p_consent_version, p_enabled);
end $$;

revoke all on function public.set_church_ai(uuid, boolean, text) from public, anon;
grant execute on function public.set_church_ai(uuid, boolean, text) to authenticated;

-- ai_enabled e o instante do consentimento só mudam por set_church_ai (que registra o consentimento):
-- update direto dessas colunas deixa de ser permitido, mesmo para admin.
revoke update on public.church_settings from authenticated;
grant update (locale, week_starts_on, rotation_policy, stage_defaults, retention_policy) on public.church_settings to authenticated;
