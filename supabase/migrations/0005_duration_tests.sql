-- Duurtest-functionaliteit: één duurtest per testsessie + checkpoints met
-- (optionele) foto en gemeten offset in seconden t.o.v. de referentietijd.
--
-- Run dit volledig in Supabase → SQL Editor → New query → Run.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Duration tests
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.duration_tests (
    id                       uuid primary key default gen_random_uuid(),
    test_session_id          uuid not null references public.test_sessions(id) on delete cascade,
    started_at               timestamptz not null default now(),
    reference_time           timestamptz not null,
    has_date_function        boolean not null default false,
    date_confirmation_done   boolean not null default false,
    active                   boolean not null default true,
    completed_at             timestamptz,
    notes                    text
);

create index if not exists duration_tests_session_idx
    on public.duration_tests (test_session_id);

-- Maximaal één actieve duurtest per testsessie.
create unique index if not exists duration_tests_one_active_per_session
    on public.duration_tests (test_session_id)
    where active;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Checkpoints (foto + offset-meting)
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.duration_checkpoints (
    id                  uuid primary key default gen_random_uuid(),
    duration_test_id    uuid not null references public.duration_tests(id) on delete cascade,
    checkpoint_time     timestamptz not null default now(),
    offset_seconds      numeric(10,3),
    photo_url           text,
    notes               text
);

create index if not exists duration_checkpoints_test_idx
    on public.duration_checkpoints (duration_test_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 3. RLS — fase 1 single-user MVP, open access
-- ──────────────────────────────────────────────────────────────────────────
alter table public.duration_tests        enable row level security;
alter table public.duration_checkpoints  enable row level security;

drop policy if exists "fase1_open_duration_tests"       on public.duration_tests;
drop policy if exists "fase1_open_duration_checkpoints" on public.duration_checkpoints;

create policy "fase1_open_duration_tests"
    on public.duration_tests
    for all using (true) with check (true);

create policy "fase1_open_duration_checkpoints"
    on public.duration_checkpoints
    for all using (true) with check (true);
