-- Run in Supabase SQL Editor.
-- Creates tables for weekly TL ratings of IK consultants.

CREATE TABLE IF NOT EXISTS public.rating_questions (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  text       text        NOT NULL,
  sort_order int         NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rating_options (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id uuid        NOT NULL REFERENCES public.rating_questions(id) ON DELETE CASCADE,
  text        text        NOT NULL,
  color       text        NOT NULL DEFAULT '#E8F5E9',
  sort_order  int         NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS rating_options_question_id_idx ON public.rating_options (question_id);

CREATE TABLE IF NOT EXISTS public.ratings (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  week        text        NOT NULL,          -- 'YYYY-Www' e.g. '2026-W19'
  rater_name  text        NOT NULL,          -- teamleder full_name
  kode        text        NOT NULL REFERENCES public.reps(kode),
  question_id uuid        NOT NULL REFERENCES public.rating_questions(id),
  option_id   uuid        NOT NULL REFERENCES public.rating_options(id),
  created_at  timestamptz DEFAULT now(),
  UNIQUE(week, kode, question_id)
);
CREATE INDEX IF NOT EXISTS ratings_week_idx  ON public.ratings (week);
CREATE INDEX IF NOT EXISTS ratings_kode_idx  ON public.ratings (kode);
CREATE INDEX IF NOT EXISTS ratings_rater_idx ON public.ratings (rater_name);

CREATE TABLE IF NOT EXISTS public.rating_comments (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  week        text        NOT NULL,          -- 'YYYY-Www'
  rater_name  text        NOT NULL,
  kode        text        NOT NULL REFERENCES public.reps(kode),
  comment     text        NOT NULL DEFAULT '',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(week, kode)
);
CREATE INDEX IF NOT EXISTS rating_comments_week_idx ON public.rating_comments (week);
CREATE INDEX IF NOT EXISTS rating_comments_kode_idx ON public.rating_comments (kode);
