-- Bảng lưu thiết bị đã bật thông báo Web Push/PWA
create table if not exists public.push_subscriptions (
    id uuid default gen_random_uuid() primary key,
    endpoint text not null unique,
    p256dh text not null,
    auth text not null,
    user_key text,
    username text,
    display_name text,
    user_role text,
    user_agent text,
    active boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "allow select push_subscriptions" on public.push_subscriptions;
drop policy if exists "allow insert push_subscriptions" on public.push_subscriptions;
drop policy if exists "allow update push_subscriptions" on public.push_subscriptions;

-- Dùng đơn giản cho hệ thống nội bộ đang chạy bằng anon/app_users.
-- Nếu sau này muốn chặt hơn, có thể ràng buộc user_key theo tài khoản đăng nhập.
create policy "allow select push_subscriptions"
on public.push_subscriptions
for select
to anon, authenticated
using (true);

create policy "allow insert push_subscriptions"
on public.push_subscriptions
for insert
to anon, authenticated
with check (true);

create policy "allow update push_subscriptions"
on public.push_subscriptions
for update
to anon, authenticated
using (true)
with check (true);
