-- IGREJAQUA — 0006: RLS em todas as tabelas + privilégios mínimos
-- Observação: ENABLE (não FORCE) porque as funções SECURITY DEFINER de `private` leem
-- church_memberships como dono da tabela; FORCE as sujeitaria à própria RLS (recursão).

do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant usage on schema public to anon, authenticated;

-- Privilégios por tabela (a RLS filtra as linhas; aqui limitamos as operações)
grant select, update on public.profiles, public.churches, public.church_settings, public.church_memberships to authenticated;
grant select, insert, update, delete on
  public.church_invitations, public.ministries, public.ministry_memberships, public.ministry_permissions,
  public.unavailabilities, public.songs, public.song_versions, public.events, public.event_sessions,
  public.event_lineup, public.event_setlist, public.event_rsvps, public.attendance_records,
  public.announcements_and_devotionals, public.prayer_interactions, public.notification_preferences,
  public.push_subscriptions, public.contributions to authenticated;
grant select on public.prayer_requests, public.prayer_request_authors, public.audit_logs, public.ai_generation_runs to authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert on public.data_subject_requests, public.consent_records to authenticated;
grant update (status, resolved_at, handled_by) on public.data_subject_requests to authenticated;
grant update (name, slug, legal_name, document_number, timezone) on public.churches to authenticated;
grant update (full_name, display_name, avatar_path, phone, locale) on public.profiles to authenticated;
grant update (role, status, is_owner) on public.church_memberships to authenticated;

grant execute on function public.create_church(text, text, text), public.accept_invitation(text),
  public.church_directory(uuid), public.get_ministry_availability(uuid, uuid),
  public.create_prayer_request(uuid, text, boolean, uuid), public.moderate_prayer_request(uuid, public.prayer_status)
  to authenticated;

-- ---------- Políticas ----------
-- profiles
create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- churches / settings / memberships / invitations
create policy churches_select on public.churches for select to authenticated using (private.is_active_member(id));
create policy churches_update on public.churches for update to authenticated
  using (private.has_church_role(id, array['admin']::public.membership_role[]))
  with check (private.has_church_role(id, array['admin']::public.membership_role[]));

create policy settings_select on public.church_settings for select to authenticated using (private.is_active_member(church_id));
create policy settings_update on public.church_settings for update to authenticated
  using (private.has_church_role(church_id, array['admin']::public.membership_role[]))
  with check (private.has_church_role(church_id, array['admin']::public.membership_role[]));

create policy memberships_select on public.church_memberships for select to authenticated
  using (user_id = (select auth.uid()) or private.is_active_member(church_id));
create policy memberships_update_admin on public.church_memberships for update to authenticated
  using (private.has_church_role(church_id, array['admin']::public.membership_role[]))
  with check (private.has_church_role(church_id, array['admin']::public.membership_role[]));

create policy invitations_admin_select on public.church_invitations for select to authenticated
  using (private.has_church_role(church_id, array['admin']::public.membership_role[]));
create policy invitations_admin_insert on public.church_invitations for insert to authenticated
  with check (private.has_church_role(church_id, array['admin']::public.membership_role[]) and invited_by = (select auth.uid()));
create policy invitations_admin_update on public.church_invitations for update to authenticated
  using (private.has_church_role(church_id, array['admin']::public.membership_role[]))
  with check (private.has_church_role(church_id, array['admin']::public.membership_role[]));
create policy invitations_admin_delete on public.church_invitations for delete to authenticated
  using (private.has_church_role(church_id, array['admin']::public.membership_role[]));

-- ministérios
create policy ministries_select on public.ministries for select to authenticated using (private.is_active_member(church_id));
create policy ministries_insert on public.ministries for insert to authenticated
  with check (private.has_church_role(church_id, array['admin']::public.membership_role[]));
create policy ministries_update on public.ministries for update to authenticated
  using (private.has_church_role(church_id, array['admin']::public.membership_role[]) or private.has_ministry_permission(church_id, id, 'manage_ministry'))
  with check (private.has_church_role(church_id, array['admin']::public.membership_role[]) or private.has_ministry_permission(church_id, id, 'manage_ministry'));
create policy ministries_delete on public.ministries for delete to authenticated
  using (private.has_church_role(church_id, array['admin']::public.membership_role[]));

create policy mm_select on public.ministry_memberships for select to authenticated using (private.is_active_member(church_id));
create policy mm_insert on public.ministry_memberships for insert to authenticated
  with check (private.has_ministry_permission(church_id, ministry_id, 'manage_members'));
create policy mm_update on public.ministry_memberships for update to authenticated
  using (private.has_ministry_permission(church_id, ministry_id, 'manage_members'))
  with check (private.has_ministry_permission(church_id, ministry_id, 'manage_members'));
create policy mm_delete on public.ministry_memberships for delete to authenticated
  using (private.has_ministry_permission(church_id, ministry_id, 'manage_members'));

create policy mp_select on public.ministry_permissions for select to authenticated
  using (private.has_church_role(church_id, array['admin','leader']::public.membership_role[])
      or ministry_membership_id in (select mm.id from public.ministry_memberships mm
                                    where mm.church_id = ministry_permissions.church_id
                                      and mm.membership_id = private.current_membership_id(ministry_permissions.church_id)));
create policy mp_insert on public.ministry_permissions for insert to authenticated
  with check (private.has_ministry_permission(church_id, ministry_id, 'manage_ministry'));
create policy mp_delete on public.ministry_permissions for delete to authenticated
  using (private.has_ministry_permission(church_id, ministry_id, 'manage_ministry'));

-- indisponibilidades: SOMENTE o titular (motivo privado)
create policy unav_own_select on public.unavailabilities for select to authenticated
  using (membership_id = private.current_membership_id(church_id));
create policy unav_own_insert on public.unavailabilities for insert to authenticated
  with check (membership_id = private.current_membership_id(church_id));
create policy unav_own_update on public.unavailabilities for update to authenticated
  using (membership_id = private.current_membership_id(church_id))
  with check (membership_id = private.current_membership_id(church_id));
create policy unav_own_delete on public.unavailabilities for delete to authenticated
  using (membership_id = private.current_membership_id(church_id));

-- repertório
create policy songs_select on public.songs for select to authenticated
  using (private.is_active_member(church_id)
         and (deleted_at is null or private.has_any_ministry_permission(church_id, array['manage_repertoire']::public.ministry_permission[])));
create policy songs_write_i on public.songs for insert to authenticated
  with check (private.has_any_ministry_permission(church_id, array['manage_repertoire']::public.ministry_permission[]));
create policy songs_write_u on public.songs for update to authenticated
  using (private.has_any_ministry_permission(church_id, array['manage_repertoire']::public.ministry_permission[]))
  with check (private.has_any_ministry_permission(church_id, array['manage_repertoire']::public.ministry_permission[]));
create policy songs_write_d on public.songs for delete to authenticated
  using (private.has_any_ministry_permission(church_id, array['manage_repertoire']::public.ministry_permission[]));

create policy sv_select on public.song_versions for select to authenticated
  using (private.is_active_member(church_id)
         and ((status = 'published' and deleted_at is null)
              or private.has_any_ministry_permission(church_id, array['manage_repertoire']::public.ministry_permission[])));
create policy sv_write_i on public.song_versions for insert to authenticated
  with check (private.has_any_ministry_permission(church_id, array['manage_repertoire']::public.ministry_permission[]));
create policy sv_write_u on public.song_versions for update to authenticated
  using (private.has_any_ministry_permission(church_id, array['manage_repertoire']::public.ministry_permission[]))
  with check (private.has_any_ministry_permission(church_id, array['manage_repertoire']::public.ministry_permission[]));
create policy sv_write_d on public.song_versions for delete to authenticated
  using (private.has_any_ministry_permission(church_id, array['manage_repertoire']::public.ministry_permission[]));

-- eventos e sessões
create policy events_select on public.events for select to authenticated
  using (private.is_active_member(church_id)
         and (deleted_at is null and status <> 'draft'
              or private.has_any_ministry_permission(church_id, array['manage_rehearsals','manage_schedule']::public.ministry_permission[])));
create policy events_insert on public.events for insert to authenticated
  with check (private.has_any_ministry_permission(church_id, array['manage_rehearsals','manage_schedule']::public.ministry_permission[]));
create policy events_update on public.events for update to authenticated
  using (private.has_any_ministry_permission(church_id, array['manage_rehearsals','manage_schedule']::public.ministry_permission[]))
  with check (private.has_any_ministry_permission(church_id, array['manage_rehearsals','manage_schedule']::public.ministry_permission[]));
create policy events_delete on public.events for delete to authenticated
  using (private.has_any_ministry_permission(church_id, array['manage_rehearsals','manage_schedule']::public.ministry_permission[]));

create policy sessions_select on public.event_sessions for select to authenticated
  using (exists (select 1 from public.events e where e.church_id = event_sessions.church_id and e.id = event_sessions.event_id));
create policy sessions_insert on public.event_sessions for insert to authenticated
  with check (private.has_any_ministry_permission(church_id, array['manage_rehearsals','manage_schedule']::public.ministry_permission[]));
create policy sessions_update on public.event_sessions for update to authenticated
  using (private.has_any_ministry_permission(church_id, array['manage_rehearsals','manage_schedule']::public.ministry_permission[]))
  with check (private.has_any_ministry_permission(church_id, array['manage_rehearsals','manage_schedule']::public.ministry_permission[]));
create policy sessions_delete on public.event_sessions for delete to authenticated
  using (private.has_any_ministry_permission(church_id, array['manage_rehearsals','manage_schedule']::public.ministry_permission[]));

-- escala
create policy lineup_select on public.event_lineup for select to authenticated
  using ((status <> 'draft' and private.is_active_member(church_id))
         or private.has_ministry_permission(church_id, ministry_id, 'manage_schedule')
         or ministry_membership_id in (select mm.id from public.ministry_memberships mm
                                       where mm.church_id = event_lineup.church_id
                                         and mm.membership_id = private.current_membership_id(event_lineup.church_id)));
create policy lineup_insert on public.event_lineup for insert to authenticated
  with check (private.has_ministry_permission(church_id, ministry_id, 'manage_schedule') and created_by = (select auth.uid()));
create policy lineup_update_manager on public.event_lineup for update to authenticated
  using (private.has_ministry_permission(church_id, ministry_id, 'manage_schedule'))
  with check (private.has_ministry_permission(church_id, ministry_id, 'manage_schedule'));
create policy lineup_update_own on public.event_lineup for update to authenticated
  using (ministry_membership_id in (select mm.id from public.ministry_memberships mm
                                    where mm.church_id = event_lineup.church_id
                                      and mm.membership_id = private.current_membership_id(event_lineup.church_id)))
  with check (status in ('confirmed','declined')
              and ministry_membership_id in (select mm.id from public.ministry_memberships mm
                                    where mm.church_id = event_lineup.church_id
                                      and mm.membership_id = private.current_membership_id(event_lineup.church_id)));
create policy lineup_delete on public.event_lineup for delete to authenticated
  using (private.has_ministry_permission(church_id, ministry_id, 'manage_schedule'));

create policy setlist_select on public.event_setlist for select to authenticated
  using (exists (select 1 from public.event_sessions s where s.church_id = event_setlist.church_id and s.id = event_setlist.session_id));
create policy setlist_insert on public.event_setlist for insert to authenticated
  with check (private.has_any_ministry_permission(church_id, array['manage_repertoire','manage_schedule']::public.ministry_permission[]));
create policy setlist_update on public.event_setlist for update to authenticated
  using (private.has_any_ministry_permission(church_id, array['manage_repertoire','manage_schedule']::public.ministry_permission[]))
  with check (private.has_any_ministry_permission(church_id, array['manage_repertoire','manage_schedule']::public.ministry_permission[]));
create policy setlist_delete on public.event_setlist for delete to authenticated
  using (private.has_any_ministry_permission(church_id, array['manage_repertoire','manage_schedule']::public.ministry_permission[]));

create policy rsvp_select on public.event_rsvps for select to authenticated
  using (membership_id = private.current_membership_id(church_id)
         or private.has_any_ministry_permission(church_id, array['manage_schedule']::public.ministry_permission[]));
create policy rsvp_insert on public.event_rsvps for insert to authenticated with check (membership_id = private.current_membership_id(church_id));
create policy rsvp_update on public.event_rsvps for update to authenticated
  using (membership_id = private.current_membership_id(church_id)) with check (membership_id = private.current_membership_id(church_id));
create policy rsvp_delete on public.event_rsvps for delete to authenticated using (membership_id = private.current_membership_id(church_id));

create policy att_select on public.attendance_records for select to authenticated
  using (membership_id = private.current_membership_id(church_id)
         or private.has_any_ministry_permission(church_id, array['manage_schedule']::public.ministry_permission[]));
create policy att_insert on public.attendance_records for insert to authenticated
  with check ((membership_id = private.current_membership_id(church_id) and method = 'self')
              or private.has_any_ministry_permission(church_id, array['manage_schedule']::public.ministry_permission[]));
create policy att_delete on public.attendance_records for delete to authenticated
  using (private.has_any_ministry_permission(church_id, array['manage_schedule']::public.ministry_permission[]));

-- comunicados
create policy content_select on public.announcements_and_devotionals for select to authenticated
  using (private.is_active_member(church_id)
         and ((status = 'published' and deleted_at is null and (audience = 'church' or private.is_ministry_member(church_id, ministry_id)))
              or (audience = 'church' and private.has_church_role(church_id, array['admin']::public.membership_role[]))
              or (audience = 'ministry' and private.has_ministry_permission(church_id, ministry_id, 'manage_content'))));
create policy content_insert on public.announcements_and_devotionals for insert to authenticated
  with check ((audience = 'church' and private.has_church_role(church_id, array['admin']::public.membership_role[]))
              or (audience = 'ministry' and private.has_ministry_permission(church_id, ministry_id, 'manage_content')));
create policy content_update on public.announcements_and_devotionals for update to authenticated
  using ((audience = 'church' and private.has_church_role(church_id, array['admin']::public.membership_role[]))
         or (audience = 'ministry' and private.has_ministry_permission(church_id, ministry_id, 'manage_content')))
  with check ((audience = 'church' and private.has_church_role(church_id, array['admin']::public.membership_role[]))
              or (audience = 'ministry' and private.has_ministry_permission(church_id, ministry_id, 'manage_content')));
create policy content_delete on public.announcements_and_devotionals for delete to authenticated
  using ((audience = 'church' and private.has_church_role(church_id, array['admin']::public.membership_role[]))
         or (audience = 'ministry' and private.has_ministry_permission(church_id, ministry_id, 'manage_content')));

-- oração
create policy prayer_select on public.prayer_requests for select to authenticated
  using (private.is_active_member(church_id)
         and (status in ('open','answered') or private.has_church_role(church_id, array['admin']::public.membership_role[])));
create policy prayer_author_own on public.prayer_request_authors for select to authenticated
  using (membership_id = private.current_membership_id(church_id));
create policy prayer_inter_select on public.prayer_interactions for select to authenticated using (private.is_active_member(church_id));
create policy prayer_inter_insert on public.prayer_interactions for insert to authenticated
  with check (membership_id = private.current_membership_id(church_id));
create policy prayer_inter_delete on public.prayer_interactions for delete to authenticated
  using (membership_id = private.current_membership_id(church_id));

-- notificações
create policy notif_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notif_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notif_delete on public.notifications for delete to authenticated using (user_id = (select auth.uid()));
create policy notifpref_all_s on public.notification_preferences for select to authenticated using (user_id = (select auth.uid()));
create policy notifpref_all_i on public.notification_preferences for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_active_member(church_id));
create policy notifpref_all_u on public.notification_preferences for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifpref_all_d on public.notification_preferences for delete to authenticated using (user_id = (select auth.uid()));
create policy push_own_s on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy push_own_i on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_own_d on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));
create policy push_own_u on public.push_subscriptions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- PIX informativo, auditoria, IA
create policy contrib_select on public.contributions for select to authenticated
  using (private.is_active_member(church_id)
         and ((visible and (valid_until is null or valid_until >= current_date))
              or private.has_church_role(church_id, array['admin']::public.membership_role[])));
create policy contrib_i on public.contributions for insert to authenticated
  with check (private.has_church_role(church_id, array['admin']::public.membership_role[]));
create policy contrib_u on public.contributions for update to authenticated
  using (private.has_church_role(church_id, array['admin']::public.membership_role[]))
  with check (private.has_church_role(church_id, array['admin']::public.membership_role[]));
create policy contrib_d on public.contributions for delete to authenticated
  using (private.has_church_role(church_id, array['admin']::public.membership_role[]));

create policy audit_admin_select on public.audit_logs for select to authenticated
  using (church_id is not null and private.has_church_role(church_id, array['admin']::public.membership_role[]));
create policy ai_runs_select on public.ai_generation_runs for select to authenticated
  using (private.has_any_ministry_permission(church_id, array['manage_schedule','manage_repertoire']::public.ministry_permission[]));

-- LGPD
create policy dsr_select on public.data_subject_requests for select to authenticated
  using (user_id = (select auth.uid()) or private.has_church_role(church_id, array['admin']::public.membership_role[]));
create policy dsr_insert on public.data_subject_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_active_member(church_id));
create policy dsr_update on public.data_subject_requests for update to authenticated
  using (private.has_church_role(church_id, array['admin']::public.membership_role[]))
  with check (private.has_church_role(church_id, array['admin']::public.membership_role[]));
create policy consent_select on public.consent_records for select to authenticated using (user_id = (select auth.uid()));
create policy consent_insert on public.consent_records for insert to authenticated with check (user_id = (select auth.uid()));
-- rate_limit_buckets e idempotency_keys: RLS ativa, sem políticas e sem grants (somente service role).
