alter table shop_settings add column if not exists admin_seeded boolean not null default false;

create table if not exists password_reset (
  token text primary key,
  user_id text not null,
  email text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_user_idx on password_reset (user_id);
