-- Voegt AI-analyse metadata toe aan timegrapher_measurements.
--   ai_analyzed         = true wanneer waarden door Claude Vision zijn ingevuld
--   original_photo_url  = link naar de bron-foto (in Supabase Storage) voor verificatie
--
-- Run dit volledig in Supabase → SQL Editor → New query → Run.

alter table public.timegrapher_measurements
    add column if not exists ai_analyzed         boolean not null default false,
    add column if not exists original_photo_url  text;
