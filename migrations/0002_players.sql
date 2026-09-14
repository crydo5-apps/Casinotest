create table if not exists player (
  user_id text primary key,
  email text not null,
  approved boolean not null default false,
  approve_token text not null unique,
  mail_sent boolean not null default false,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create index if not exists player_approve_token_idx on player (approve_token);
