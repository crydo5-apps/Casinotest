create table if not exists play_log (
  id text primary key,
  user_id text not null,
  game text not null,
  kind text not null,
  stake integer not null,
  payout integer not null,
  delta integer not null,
  balance integer not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists play_log_user_idx on play_log (user_id, created_at desc);
create index if not exists play_log_created_idx on play_log (created_at desc);

alter table shop_settings add column if not exists dashboard_token text not null default '';
