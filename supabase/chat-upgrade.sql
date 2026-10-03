-- UP 2 Hand — Chat upgrade (เวลา/อ่านแล้ว/ส่งรูป)
-- Run ONCE in Supabase SQL Editor, AFTER schema.sql

-- 1) message รองรับรูปภาพ
alter table public.message
  add column if not exists message_type text not null default 'text'
    check (message_type in ('text', 'image'));
alter table public.message
  add column if not exists image_url text;

-- 2) จำเวลาอ่านล่าสุดของแต่ละคนในแต่ละห้อง
create table if not exists public.conversation_read (
  conversation_id uuid not null references public.conversation(conversation_id) on delete cascade,
  member_id uuid not null references public.member(member_id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, member_id)
);

alter table public.conversation_read enable row level security;

-- อ่านได้เฉพาะคู่สนทนาในห้อง + admin
drop policy if exists "conv_read_party" on public.conversation_read;
create policy "conv_read_party" on public.conversation_read for select using (
  auth.uid() = member_id
  or exists (
    select 1 from public.conversation c
    left join public.item i on i.item_id = c.item_id
    where c.conversation_id = conversation_read.conversation_id
      and (c.member_id = auth.uid() or i.member_id = auth.uid())
  )
  or public.is_admin()
);

-- เขียนได้เฉพาะแถวของตัวเอง (upsert)
drop policy if exists "conv_read_own_write" on public.conversation_read;
create policy "conv_read_own_write" on public.conversation_read for insert
  with check (auth.uid() = member_id);
drop policy if exists "conv_read_own_update" on public.conversation_read;
create policy "conv_read_own_update" on public.conversation_read for update
  using (auth.uid() = member_id);

-- 3) Realtime ให้ตาราง read-state (เห็น ✓✓ ทันที)
do $$
begin
  alter publication supabase_realtime add table public.conversation_read;
exception when duplicate_object then
  -- เคย add แล้ว ข้ามได้
  null;
end $$;

-- 4) bucket เก็บรูปในแชท
insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do nothing;

drop policy if exists "chat_images_public_read" on storage.objects;
create policy "chat_images_public_read"
on storage.objects for select
using (bucket_id = 'chat-images');

drop policy if exists "chat_images_auth_write" on storage.objects;
create policy "chat_images_auth_write"
on storage.objects for insert
with check (
  bucket_id = 'chat-images'
  and auth.role() = 'authenticated'
);

drop policy if exists "chat_images_auth_delete" on storage.objects;
create policy "chat_images_auth_delete"
on storage.objects for delete
using (
  bucket_id = 'chat-images'
  and auth.role() = 'authenticated'
);
