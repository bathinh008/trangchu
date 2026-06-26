-- Dashboard V2: thời gian xử lý, người phụ trách và hạn xử lý
-- Chạy toàn bộ file này trong Supabase > SQL Editor.

alter table public.defects
    add column if not exists updated_at timestamptz default now(),
    add column if not exists fixing_at timestamptz,
    add column if not exists resolved_at timestamptz,
    add column if not exists assigned_to text,
    add column if not exists due_at timestamptz,
    add column if not exists resolution_note text;

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

create index if not exists idx_defects_status_due_at
    on public.defects (status, due_at);

create index if not exists idx_defects_resolved_at
    on public.defects (resolved_at desc);

comment on column public.defects.fixing_at is 'Thời điểm chuyển sang trạng thái đang sửa';
comment on column public.defects.resolved_at is 'Thời điểm hoàn thành xử lý';
comment on column public.defects.assigned_to is 'Tên người phụ trách xử lý';
comment on column public.defects.due_at is 'Hạn xử lý dự kiến';
comment on column public.defects.resolution_note is 'Ghi chú kết quả xử lý';
