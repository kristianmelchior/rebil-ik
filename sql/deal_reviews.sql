-- Run in Supabase SQL Editor.
-- Stores TL review/snooze state per deal.
-- A deal is "snoozed" until reviewed_at + snooze_days days have passed.

CREATE TABLE IF NOT EXISTS public.deal_reviews (
  deal_id     text PRIMARY KEY,
  reviewed_by text        NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  snooze_days int         NOT NULL DEFAULT 2
);
