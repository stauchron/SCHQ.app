-- Voegt 12H en 6H toe aan de timegrapher_measurements tabel.
-- Dit maakt het de volledige 6-positie chronometer-test (CH/FH/9H/3H/12H/6H).
--
-- Run dit volledig in Supabase → SQL Editor → New query → Run.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Kolommen toevoegen voor 12H (kroon boven) en 6H (kroon onder)
-- ──────────────────────────────────────────────────────────────────────────
alter table public.timegrapher_measurements
    add column if not exists h12_rate        numeric(6,2),
    add column if not exists h12_amplitude   numeric(6,2),
    add column if not exists h12_beat_error  numeric(4,2),
    add column if not exists h6_rate         numeric(6,2),
    add column if not exists h6_amplitude    numeric(6,2),
    add column if not exists h6_beat_error   numeric(4,2);

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Trigger uitbreiden zodat 12H en 6H meedoen in gemiddelden + differentiatie
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.compute_measurement_averages()
returns trigger
language plpgsql
as $$
declare
    rates    numeric[] := array_remove(
        array[new.ch_rate, new.fh_rate, new.h12_rate, new.h6_rate, new.h9_rate, new.h3_rate],
        null
    );
    amps     numeric[] := array_remove(
        array[new.ch_amplitude, new.fh_amplitude, new.h12_amplitude, new.h6_amplitude, new.h9_amplitude, new.h3_amplitude],
        null
    );
    beats    numeric[] := array_remove(
        array[new.ch_beat_error, new.fh_beat_error, new.h12_beat_error, new.h6_beat_error, new.h9_beat_error, new.h3_beat_error],
        null
    );
begin
    new.avg_rate        := case when array_length(rates, 1) > 0 then (select avg(v) from unnest(rates) v) end;
    new.avg_amplitude   := case when array_length(amps, 1)  > 0 then (select avg(v) from unnest(amps)  v) end;
    new.avg_beat_error  := case when array_length(beats, 1) > 0 then (select avg(v) from unnest(beats) v) end;

    new.rate_difference := case
        when array_length(rates, 1) > 0
        then (select max(v) - min(v) from unnest(rates) v)
    end;
    new.amplitude_difference := case
        when array_length(amps, 1) > 0
        then (select max(v) - min(v) from unnest(amps) v)
    end;

    return new;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Backfill: bestaande rijen herberekenen via no-op update
-- ──────────────────────────────────────────────────────────────────────────
update public.timegrapher_measurements set id = id;
