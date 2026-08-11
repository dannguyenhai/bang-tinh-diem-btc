-- Chạy toàn bộ file này trong Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Chạy lại nhiều lần vẫn an toàn.
--
-- Mô hình bảo mật:
--   game_state  chứa toàn bộ ván chơi. RLS bật và KHÔNG có policy nào
--               → anon key không đọc/ghi được một dòng nào. Chỉ service_role
--               (chạy trong API route của Next.js, không lộ ra trình duyệt) mới chạm tới.
--   game_pulse  chỉ chứa số version. anon đọc được để nhận tín hiệu realtime,
--               rồi gọi /api/state để lấy dữ liệu ĐÃ LỌC theo vai của mình.

create table if not exists public.game_state (
  id          text primary key,
  version     bigint      not null default 1,
  state       jsonb       not null,
  updated_at  timestamptz not null default now()
);

create table if not exists public.game_pulse (
  id          text primary key,
  version     bigint      not null default 1,
  updated_at  timestamptz not null default now()
);

alter table public.game_state enable row level security;
alter table public.game_pulse enable row level security;

-- game_state: gỡ sạch mọi policy cũ. Không tạo policy mới → anon bị chặn hoàn toàn.
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'game_state'
  loop
    execute format('drop policy %I on public.game_state', pol.policyname);
  end loop;
end $$;

-- game_pulse: chỉ cho đọc, và chỉ có mỗi con số version.
drop policy if exists "game_pulse_select" on public.game_pulse;
create policy "game_pulse_select"
  on public.game_pulse for select
  to anon, authenticated
  using (true);

-- Mỗi lần state đổi, đập nhịp để các thiết bị biết đường gọi lại /api/state.
create or replace function public.sync_game_pulse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.game_pulse (id, version, updated_at)
  values (new.id, new.version, now())
  on conflict (id) do update
    set version = excluded.version,
        updated_at = excluded.updated_at;
  return new;
end $$;

drop trigger if exists game_state_pulse on public.game_state;
create trigger game_state_pulse
  after insert or update on public.game_state
  for each row execute function public.sync_game_pulse();

alter table public.game_pulse replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'game_pulse'
  ) then
    alter publication supabase_realtime add table public.game_pulse;
  end if;

  -- Nếu bản cũ từng đưa game_state lên realtime thì gỡ ra: realtime phát
  -- nguyên payload, đưa lên là lộ hết dữ liệu chiến thuật.
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'game_state'
  ) then
    alter publication supabase_realtime drop table public.game_state;
  end if;
end $$;
