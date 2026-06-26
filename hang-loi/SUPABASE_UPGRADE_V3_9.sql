-- Dashboard V3.9: chỉ còn 2 trạng thái Chờ xử lý và Hoàn thành
-- Chạy trong Supabase > SQL Editor. Không xóa dữ liệu hay cột cũ.

alter table public.defects
    add column if not exists updated_at timestamptz default now(),
    add column if not exists resolved_at timestamptz,
    add column if not exists resolution_note text;

-- Dữ liệu cũ ở trạng thái Fixing sẽ được chuyển về Chờ xử lý.
update public.defects
set status = 'Pending'
where status = 'Fixing';

create or replace function public.set_defects_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_defects_updated_at on public.defects;
create trigger trg_defects_updated_at
before update on public.defects
for each row
execute function public.set_defects_updated_at();

create index if not exists idx_defects_status on public.defects (status);
create index if not exists idx_defects_resolved_at on public.defects (resolved_at desc);

comment on column public.defects.resolved_at is 'Thời điểm chuyển sang trạng thái Hoàn thành';
comment on column public.defects.resolution_note is 'Ghi chú kết quả xử lý';
