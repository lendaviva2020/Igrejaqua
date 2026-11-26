-- IGREJAQUA — 0001: extensões, enums, schema privado, utilitários
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.church_status as enum ('active','suspended','archived');
create type public.membership_role as enum ('admin','leader','member');
create type public.membership_status as enum ('invited','active','suspended','left');
create type public.ministry_member_role as enum ('coordinator','member');
create type public.ministry_permission as enum (
  'manage_ministry','manage_members','manage_schedule','publish_schedule',
  'manage_repertoire','manage_rehearsals','manage_content','view_availability');
create type public.event_kind as enum ('service','rehearsal','special','meeting');
create type public.event_status as enum ('draft','scheduled','cancelled','done');
create type public.lineup_status as enum ('draft','published','confirmed','declined','replaced','cancelled');
create type public.content_kind as enum ('announcement','devotional');
create type public.content_status as enum ('draft','scheduled','published','archived');
create type public.rsvp_status as enum ('going','not_going','maybe');
create type public.ai_run_kind as enum ('schedule','repertoire','vocal_key','rehearsal_plan','transitions');
create type public.ai_run_status as enum ('pending','generated','validation_failed','validated','accepted','discarded','error');
create type public.notification_channel as enum ('in_app','push','email');
create type public.prayer_status as enum ('open','answered','archived','removed');
create type public.pix_key_type as enum ('cpf','cnpj','email','phone','random');
create type public.content_audience as enum ('church','ministry');
create type public.checkin_method as enum ('self','leader','qr');
create type public.dsr_kind as enum ('access','correction','erasure','portability','revocation');
create type public.dsr_status as enum ('open','in_progress','done','rejected');

create or replace function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
