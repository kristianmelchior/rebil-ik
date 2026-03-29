-- Run in Supabase SQL editor (once). Requires public.sales(id).

create table if not exists public.feed_reactions (
  id uuid primary key default gen_random_uuid(),
  sale_id integer not null references public.sales (id) on delete cascade,
  kode text not null,
  rep_name text not null,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (sale_id, kode, emoji)
);

create index if not exists feed_reactions_sale_id_idx on public.feed_reactions (sale_id);

create table if not exists public.feed_comments (
  id uuid primary key default gen_random_uuid(),
  sale_id integer not null references public.sales (id) on delete cascade,
  kode text not null,
  rep_name text not null,
  body text not null check (char_length(body) > 0 and char_length(body) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists feed_comments_sale_id_idx on public.feed_comments (sale_id);

-- Match your existing RLS style; permissive policies for anon (dashboard uses anon key server-side).
alter table public.feed_reactions enable row level security;
alter table public.feed_comments enable row level security;

create policy "feed_reactions_all" on public.feed_reactions for all using (true) with check (true);
create policy "feed_comments_all" on public.feed_comments for all using (true) with check (true);
