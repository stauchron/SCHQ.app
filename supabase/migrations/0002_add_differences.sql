-- Voegt rate_difference en amplitude_difference toe aan timegrapher_measurements.
-- Differentiatie = max - min van de ingevulde posities (CH/9H/3H/FH).
--
-- Run dit volledig in Supabase → SQL Editor → New query → Run.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Kolommen toevoegen (idempotent)
-- ──────────────────────────────────────────────────────────────────────────
alter table public.timegrapher_measurements
    add column if not exists rate_difference      numeric(6,2),
    add column if not exists amplitude_difference numeric(6,2);

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Trigger-functie uitbreiden: óók de differentiatie berekenen
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

    -- Differentiatie: max − min. Vereist ≥1 ingevulde positie; bij 1 positie is het 0.
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
-- 3. Backfill: bestaande rijen herberekenen door een no-op update
-- ──────────────────────────────────────────────────────────────────────────
update public.timegrapher_measurements set id = id;
