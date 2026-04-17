-- Archief-view + zoek-indexes
--
-- archived_sessions_view: één rij per voltooide sessie + paspoort-velden +
-- pre-getelde counts voor de drie test-types. Gebruikt door /archive.
--
-- pg_trgm: maakt snelle ILIKE-zoekopdrachten op serial / sku / model mogelijk.
--
-- Run dit volledig in Supabase → SQL Editor → New query → Run.

create extension if not exists pg_trgm;

-- ──────────────────────────────────────────────────────────────────────────
-- View
-- ──────────────────────────────────────────────────────────────────────────
drop view if exists public.archived_sessions_view;
create view public.archived_sessions_view
with (security_invoker = true)
as
select
    ts.id,
    ts.watch_passport_id,
    ts.started_at,
    ts.completed_at,
    ts.status,
    ts.notes,
    wp.serial_number,
    wp.sku,
    wp.model_name,
    wp.movement_type,
    coalesce(
        (select count(*) from public.timegrapher_measurements
            where test_session_id = ts.id),
        0
    )::int as measurement_count,
    coalesce(
        (select count(*) from public.duration_tests
            where test_session_id = ts.id),
        0
    )::int as duration_test_count,
    coalesce(
        (select count(*) from public.power_reserve_tests
            where test_session_id = ts.id),
        0
    )::int as power_reserve_count
from public.test_sessions ts
join public.watch_passports wp on ts.watch_passport_id = wp.id
where ts.status = 'completed';

-- ──────────────────────────────────────────────────────────────────────────
-- Trigram-indexes (snel partial-match op ILIKE '%q%')
-- ──────────────────────────────────────────────────────────────────────────
create index if not exists watch_passports_serial_trgm
    on public.watch_passports using gin (serial_number gin_trgm_ops);
create index if not exists watch_passports_sku_trgm
    on public.watch_passports using gin (sku gin_trgm_ops);
create index if not exists watch_passports_model_trgm
    on public.watch_passports using gin (model_name gin_trgm_ops);

-- Voor sortering op completed_at desc (meest recente eerst)
create index if not exists test_sessions_completed_at_desc
    on public.test_sessions (completed_at desc nulls last)
    where status = 'completed';
