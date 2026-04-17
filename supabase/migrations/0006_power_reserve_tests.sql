-- Gangreserve-test: hoe lang loopt het horloge na volledig opwinden?
-- Eén actieve test per sessie. Checkpoints registreren of het horloge nog
-- loopt + (bij datumfunctie) wat de datumweergave is.
--
-- Run dit volledig in Supabase → SQL Editor → New query → Run.

create table if not exists public.power_reserve_tests (
    id                       uuid primary key default gen_random_uuid(),
    test_session_id          uuid not null references public.test_sessions(id) on delete cascade,
    started_at               timestamptz not null default now(),
    ended_at                 timestamptz,
    still_running            boolean not null default true,
    reminder_interval_hours  integer not null default 12,
    has_date_function        boolean not null default false,
    notes                    text
);

create index if not exists power_reserve_tests_session_idx
    on public.power_reserve_tests (test_session_id);

-- Maximaal één lopende gangreserve-test per testsessie.
create unique index if not exists power_reserve_tests_one_running_per_session
    on public.power_reserve_tests (test_session_id)
    where still_running;

create table if not exists public.power_reserve_checkpoints (
    id                       uuid primary key default gen_random_uuid(),
    power_reserve_test_id    uuid not null references public.power_reserve_tests(id) on delete cascade,
    checkpoint_time          timestamptz not null default now(),
    watch_running            boolean not null,
    watch_time_photo_url     text,
    watch_date_display       text,
    manual_notes             text
);

create index if not exists power_reserve_checkpoints_test_idx
    on public.power_reserve_checkpoints (power_reserve_test_id);

-- RLS — fase 1 open access
alter table public.power_reserve_tests        enable row level security;
alter table public.power_reserve_checkpoints  enable row level security;

drop policy if exists "fase1_open_power_reserve_tests"       on public.power_reserve_tests;
drop policy if exists "fase1_open_power_reserve_checkpoints" on public.power_reserve_checkpoints;

create policy "fase1_open_power_reserve_tests"
    on public.power_reserve_tests
    for all using (true) with check (true);

create policy "fase1_open_power_reserve_checkpoints"
    on public.power_reserve_checkpoints
    for all using (true) with check (true);
