-- IGREJAQUA — link de referência da música (ex.: vídeo no YouTube para a equipe ensaiar).
-- Opcional; só https (vira <a href> na tela: nunca javascript:, data: ou http).

alter table public.songs
  add column reference_url text
  check (reference_url is null or (char_length(reference_url) <= 500 and reference_url ~ '^https://[^[:space:]<>"'']+$'));

comment on column public.songs.reference_url is 'Link público de referência (vídeo/áudio) informado pela liderança. Só https.';

-- create_song ganha p_reference_url (opcional, por último): chamadas antigas continuam válidas.
drop function public.create_song(uuid, text, text, text, text, smallint);

create function public.create_song(
  p_church uuid, p_title text, p_artist text, p_key text, p_chordpro text, p_bpm smallint default null, p_reference_url text default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_song uuid;
begin
  insert into public.songs (church_id, title, artist, default_key, reference_url, created_by)
  values (p_church, btrim(p_title), nullif(btrim(coalesce(p_artist, '')), ''), p_key, nullif(btrim(coalesce(p_reference_url, '')), ''), (select auth.uid()))
  returning id into v_song;
  insert into public.song_versions (church_id, song_id, original_key, chordpro, bpm, status, is_default, created_by)
  values (p_church, v_song, p_key, p_chordpro, p_bpm, 'published', true, (select auth.uid()));
  return v_song;
end $$;
revoke execute on function public.create_song(uuid, text, text, text, text, smallint, text) from public, anon;
grant execute on function public.create_song(uuid, text, text, text, text, smallint, text) to authenticated;
