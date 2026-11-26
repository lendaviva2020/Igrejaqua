-- IGREJAQUA — 0007: criação atômica de música + versão padrão (SECURITY INVOKER: a RLS do chamador vale)
create or replace function public.create_song(
  p_church uuid, p_title text, p_artist text, p_key text, p_chordpro text, p_bpm smallint default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_song uuid;
begin
  insert into public.songs (church_id, title, artist, default_key, created_by)
  values (p_church, btrim(p_title), nullif(btrim(coalesce(p_artist, '')), ''), p_key, (select auth.uid()))
  returning id into v_song;
  insert into public.song_versions (church_id, song_id, original_key, chordpro, bpm, status, is_default, created_by)
  values (p_church, v_song, p_key, p_chordpro, p_bpm, 'published', true, (select auth.uid()));
  return v_song;
end $$;
revoke execute on function public.create_song(uuid, text, text, text, text, smallint) from public, anon;
grant execute on function public.create_song(uuid, text, text, text, text, smallint) to authenticated;
