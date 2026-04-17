-- Schema voor Staudt testadministratie — Fase 1
-- Run dit volledig in Supabase → SQL Editor → New query → Run.

-- UUID-extensie (komt standaard mee in Supabase, dit is no-op als al aan)
create extension if not exists "pgcrypto";

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Watch passport (paspoort per fysiek horloge, uniek op serienummer)
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.watch_passports (
    id              uuid primary key default gen_random_uuid(),
    serial_number   text not null unique,
    sku             text not null,
    model_name      text,
    movement_type   text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists watch_passports_serial_idx
    on public.watch_passports (serial_number);

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Test sessions
-- ──────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'test_session_status') then
    create type public.test_session_status as enum ('active', 'completed');
  end if;
end$$;

create table if not exists public.test_sessions (
    id                  uuid primary key default gen_random_uuid(),
    watch_passport_id   uuid not null references public.watch_passports(id) on delete cascade,
    status              public.test_session_status not null default 'active',
    started_at          timestamptz not null default now(),
    completed_at        timestamptz,
    notes               text
);

create index if not exists test_sessions_passport_idx
    on public.test_sessions (watch_passport_id);
create index if not exists test_sessions_status_idx
    on public.test_sessions (status);

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Timegrapher measurements (één rij per meetmoment, alle 4 posities inline)
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.timegrapher_measurements (
    id                      uuid primary key default gen_random_uuid(),
    test_session_id         uuid not null references public.test_sessions(id) on delete cascade,
    measurement_timestamp   timestamptz not null default now(),

    -- CH (cadran haut / dial up)
    ch_rate         numeric(6,2),
    ch_amplitude    numeric(6,2),
    ch_beat_error   numeric(4,2),

    -- 9H (kroon links)
    h9_rate         numeric(6,2),
    h9_amplitude    numeric(6,2),
    h9_beat_error   numeric(4,2),

    -- 3H (kroon rechts)
    h3_rate         numeric(6,2),
    h3_amplitude    numeric(6,2),
    h3_beat_error   numeric(4,2),

    -- FH (cadran bas / dial down)
    fh_rate         numeric(6,2),
    fh_amplitude    numeric(6,2),
    fh_beat_error   numeric(4,2),

    -- Auto-berekend door trigger hieronder
    avg_rate         numeric(6,2),
    avg_amplitude    numeric(6,2),
    avg_beat_error   numeric(4,2),

    photo_url   text,
    notes       text
);

create index if not exists timegrapher_measurements_session_idx
    on public.timegrapher_measurements (test_session_id);

-- ──────────────────────────────────────────────────────────────────────────
-- Trigger: gemiddelden automatisch berekenen op insert/update
-- (negeert NULL-posities — gemiddelde over alleen de ingevulde waardes)
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.compute_measurement_averages()
returns trigger
language plpgsql
as $$
declare
    rates    numeric[] := array_remove(array[new.ch_rate, new.h9_rate, new.h3_rate, new.fh_rate], null);
    amps     numeric[] := array_remove(array[new.ch_amplitude, new.h9_amplitude, new.h3_amplitude, new.fh_amplitude], null);
    beats    numeric[] := array_remove(array[new.ch_beat_error, new.h9_beat_error, new.h3_beat_error, new.fh_beat_error], null);
begin
    new.avg_rate        := case when array_length(rates, 1) > 0 then (select avg(v) from unnest(rates) v) end;
    new.avg_amplitude   := case when array_length(amps, 1)  > 0 then (select avg(v) from unnest(amps)  v) end;
    new.avg_beat_error  := case when array_length(beats, 1) > 0 then (select avg(v) from unnest(beats) v) end;
    return new;
end;
$$;

drop trigger if exists trg_compute_measurement_averages on public.timegrapher_measurements;
create trigger trg_compute_measurement_averages
    before insert or update on public.timegrapher_measurements
    for each row execute function public.compute_measurement_averages();

-- ──────────────────────────────────────────────────────────────────────────
-- Trigger: updated_at op watch_passports bij iedere update
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_touch_watch_passports on public.watch_passports;
create trigger trg_touch_watch_passports
    before update on public.watch_passports
    for each row execute function public.touch_updated_at();

-- ──────────────────────────────────────────────────────────────────────────
-- Row Level Security — Fase 1 is single-user MVP zonder login.
-- We zetten RLS aan en geven de anon-key full access. In Fase 2 vervangen
-- we deze policies door auth.uid()-gebaseerde regels.
-- ──────────────────────────────────────────────────────────────────────────
alter table public.watch_passports         enable row level security;
alter table public.test_sessions           enable row level security;
alter table public.timegrapher_measurements enable row level security;

drop policy if exists "fase1_open_passports"    on public.watch_passports;
drop policy if exists "fase1_open_sessions"     on public.test_sessions;
drop policy if exists "fase1_open_measurements" on public.timegrapher_measurements;

create policy "fase1_open_passports"
    on public.watch_passports
    for all using (true) with check (true);

create policy "fase1_open_sessions"
    on public.test_sessions
    for all using (true) with check (true);

create policy "fase1_open_measurements"
    on public.timegrapher_measurements
    for all using (true) with check (true);

-- ──────────────────────────────────────────────────────────────────────────
-- Storage bucket voor meetfoto's
-- (alternatief: maak handmatig een bucket "measurement-photos" via UI, public)
-- ──────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('measurement-photos', 'measurement-photos', true)
on conflict (id) do nothing;

drop policy if exists "fase1_photos_read"    on storage.objects;
drop policy if exists "fase1_photos_write"   on storage.objects;
drop policy if exists "fase1_photos_update"  on storage.objects;
drop policy if exists "fase1_photos_delete"  on storage.objects;

create policy "fase1_photos_read"
    on storage.objects for select
    using (bucket_id = 'measurement-photos');

create policy "fase1_photos_write"
    on storage.objects for insert
    with check (bucket_id = 'measurement-photos');

create policy "fase1_photos_update"
    on storage.objects for update
    using (bucket_id = 'measurement-photos')
    with check (bucket_id = 'measurement-photos');

create policy "fase1_photos_delete"
    on storage.objects for delete
    using (bucket_id = 'measurement-photos');
