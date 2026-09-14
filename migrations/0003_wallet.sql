alter table player add column if not exists credits integer not null default 0;

create table if not exists deposit (
  id text primary key,
  user_id text not null,
  email text not null,
  chf integer not null,
  credits integer not null,
  method text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists deposit_status_idx on deposit (status, created_at desc);
create index if not exists deposit_user_idx on deposit (user_id, created_at desc);

create table if not exists shop_settings (
  id integer primary key,
  twint_phone text not null default '',
  twint_name text not null default ''
);

insert into shop_settings (id, twint_phone, twint_name)
values (1, '', '')
on conflict (id) do nothing;
