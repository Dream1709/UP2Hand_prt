-- =====================================================================
-- UP 2 Hand — Full Database Schema (ไฟล์รวมฉบับส่ง)
-- =====================================================================
-- รวมจาก: schema.sql + chat-upgrade.sql + review-unique.sql
--         + storage.sql + avatars.sql + realtime.sql
-- ไม่รวม seed data (โครงสร้างล้วน)
--
-- วิธีใช้: Supabase Dashboard → SQL Editor → New query → วางทั้งไฟล์ → Run
-- รันซ้ำได้อย่างปลอดภัย (ทุกคำสั่งเป็น IF NOT EXISTS / DROP IF EXISTS)
-- สิ่งที่ต้องตั้งมือแยก (ทำใน Dashboard ไม่ใช่ SQL):
--   1) Authentication → Providers → Google (OAuth Client ID/Secret)
--   2) Authentication → URL Configuration (Site URL + Redirect URLs)
-- =====================================================================

-- ============ 0) Extensions ============
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ============ 1) MEMBER (ผู้ใช้) ============
create table if not exists public.member (
  member_id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  avatar_url text,
  role text not null default 'member' check (role in ('member','admin')),
  is_banned boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============ 2) ITEM (ประกาศขาย) ============
create table if not exists public.item (
  item_id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '',
  price numeric not null default 0 check (price >= 0),
  status text not null default 'available' check (status in ('available','sold','suspended')),
  created_at timestamptz not null default now(),
  member_id uuid not null references public.member(member_id) on delete cascade
);
create index if not exists idx_item_created on public.item(created_at desc);
create index if not exists idx_item_status_created on public.item(status, created_at desc);
create index if not exists idx_item_title_trgm on public.item using gin (title gin_trgm_ops);
create index if not exists idx_item_member on public.item(member_id);

-- ============ 3) ITEM_IMAGE (รูปสินค้า 1–5 รูป) ============
create table if not exists public.item_image (
  image_id uuid primary key default gen_random_uuid(),
  image_url text not null,
  created_at timestamptz not null default now(),
  item_id uuid not null references public.item(item_id) on delete cascade
);
create index if not exists idx_item_image_item on public.item_image(item_id);

-- ============ 4) CONVERSATION (ห้องแชท: 1 สินค้า × 1 ผู้ซื้อ = 1 ห้อง) ============
create table if not exists public.conversation (
  conversation_id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  item_id uuid not null references public.item(item_id) on delete cascade,
  member_id uuid not null references public.member(member_id) on delete cascade,
  unique (item_id, member_id)
);
create index if not exists idx_conv_item on public.conversation(item_id);
create index if not exists idx_conv_member on public.conversation(member_id);

-- ============ 5) MESSAGE (ข้อความ + รูปในแชท) ============
create table if not exists public.message (
  message_id uuid primary key default gen_random_uuid(),
  message_text text not null check (char_length(message_text) between 1 and 2000),
  message_type text not null default 'text' check (message_type in ('text','image')),
  image_url text,
  created_at timestamptz not null default now(),
  conversation_id uuid not null references public.conversation(conversation_id) on delete cascade,
  sender_id uuid not null references public.member(member_id) on delete cascade
);
create index if not exists idx_msg_conv_created on public.message(conversation_id, created_at);

-- ============ 6) REVIEW (รีวิว: 1 คนรีวิวอีกคนได้ครั้งเดียว) ============
create table if not exists public.review (
  review_id uuid primary key default gen_random_uuid(),
  rating int not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  reviewer_id uuid not null references public.member(member_id) on delete cascade,
  reviewee_id uuid not null references public.member(member_id) on delete cascade,
  check (reviewer_id <> reviewee_id),
  unique (reviewer_id, reviewee_id)
);
create index if not exists idx_review_reviewee on public.review(reviewee_id, created_at desc);
create index if not exists idx_review_reviewer on public.review(reviewer_id);

-- ============ 7) CONVERSATION_READ (เวลาอ่านแชทล่าสุด: สถานะ ✓✓) ============
create table if not exists public.conversation_read (
  conversation_id uuid not null references public.conversation(conversation_id) on delete cascade,
  member_id uuid not null references public.member(member_id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, member_id)
);

-- ============ 8) Trigger + Functions ============
-- สร้างแถว member อัตโนมัติเมื่อสมัครสมาชิก (ผูก auth.users.id = member.member_id)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.member (member_id, name, email, avatar_url, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    'member'
  )
  on conflict (member_id) do update set
    name = excluded.name,
    avatar_url = excluded.avatar_url;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- helper ตรวจสิทธิ์ admin (ใช้ซ้ำใน RLS ทุกตาราง)
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.member where member_id = auth.uid() and role = 'admin') $$;

-- ============ 9) Row Level Security ============
alter table public.member enable row level security;
alter table public.item enable row level security;
alter table public.item_image enable row level security;
alter table public.conversation enable row level security;
alter table public.message enable row level security;
alter table public.review enable row level security;
alter table public.conversation_read enable row level security;

-- MEMBER: ทุกคนอ่านได้, เขียนได้เฉพาะตัวเอง, admin ได้หมด
drop policy if exists "member_read_all" on public.member;
create policy "member_read_all" on public.member for select using (true);
drop policy if exists "member_update_own" on public.member;
create policy "member_update_own" on public.member for update using (auth.uid() = member_id);
drop policy if exists "member_admin_all" on public.member;
create policy "member_admin_all" on public.member for all using (public.is_admin());

-- ITEM: guest อ่านเฉพาะ available; เจ้าของเห็นของตัวเองทุกสถานะ; admin เห็นหมด
drop policy if exists "item_read" on public.item;
create policy "item_read" on public.item for select using (
  status = 'available' or auth.uid() = member_id or public.is_admin()
);
drop policy if exists "item_insert_own" on public.item;
create policy "item_insert_own" on public.item for insert with check (auth.uid() = member_id);
drop policy if exists "item_update_own" on public.item;
create policy "item_update_own" on public.item for update using (auth.uid() = member_id or public.is_admin());
drop policy if exists "item_delete_own" on public.item;
create policy "item_delete_own" on public.item for delete using (auth.uid() = member_id or public.is_admin());

-- ITEM_IMAGE: อ่านได้ทุกคน, เขียน/ลบได้เฉพาะเจ้าของประกาศ
drop policy if exists "item_image_read" on public.item_image;
create policy "item_image_read" on public.item_image for select using (true);
drop policy if exists "item_image_write_owner" on public.item_image;
create policy "item_image_write_owner" on public.item_image for insert with check (
  exists (select 1 from public.item where item.item_id = item_image.item_id and item.member_id = auth.uid())
  or public.is_admin()
);
drop policy if exists "item_image_delete_owner" on public.item_image;
create policy "item_image_delete_owner" on public.item_image for delete using (
  exists (select 1 from public.item where item.item_id = item_image.item_id and item.member_id = auth.uid())
  or public.is_admin()
);

-- CONVERSATION: คู่สนทนา (buyer/seller ผ่าน item) + admin
drop policy if exists "conv_all_owner" on public.conversation;
create policy "conv_all_owner" on public.conversation for all using (
  auth.uid() = member_id
  or exists (select 1 from public.item where item.item_id = conversation.item_id and item.member_id = auth.uid())
  or public.is_admin()
);

-- MESSAGE: คู่สนทนา + admin
drop policy if exists "msg_all_party" on public.message;
create policy "msg_all_party" on public.message for all using (
  exists (
    select 1 from public.conversation c
    left join public.item i on i.item_id = c.item_id
    where c.conversation_id = message.conversation_id
      and (c.member_id = auth.uid() or i.member_id = auth.uid())
  )
  or public.is_admin()
);

-- REVIEW: อ่านได้ทุกคน, สร้างได้เฉพาะแถวของตัวเอง
drop policy if exists "review_read_all" on public.review;
create policy "review_read_all" on public.review for select using (true);
drop policy if exists "review_insert_own" on public.review;
create policy "review_insert_own" on public.review for insert with check (auth.uid() = reviewer_id);

-- CONVERSATION_READ: อ่านได้เฉพาะคู่สนทนา, เขียนได้เฉพาะแถวของตัวเอง
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
drop policy if exists "conv_read_own_write" on public.conversation_read;
create policy "conv_read_own_write" on public.conversation_read for insert
  with check (auth.uid() = member_id);
drop policy if exists "conv_read_own_update" on public.conversation_read;
create policy "conv_read_own_update" on public.conversation_read for update
  using (auth.uid() = member_id);

-- ============ 10) Storage buckets (รูปสินค้า / รูปโปรไฟล์ / รูปในแชท) ============
insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do nothing;

-- item-images
drop policy if exists "item_images_public_read" on storage.objects;
create policy "item_images_public_read"
on storage.objects for select
using (bucket_id = 'item-images');
drop policy if exists "item_images_auth_write" on storage.objects;
create policy "item_images_auth_write"
on storage.objects for insert
with check (bucket_id = 'item-images' and auth.role() = 'authenticated');
drop policy if exists "item_images_auth_delete" on storage.objects;
create policy "item_images_auth_delete"
on storage.objects for delete
using (bucket_id = 'item-images' and auth.role() = 'authenticated');

-- avatars
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
on storage.objects for select
using (bucket_id = 'avatars');
drop policy if exists "avatars_auth_write" on storage.objects;
create policy "avatars_auth_write"
on storage.objects for insert
with check (bucket_id = 'avatars' and auth.role() = 'authenticated');
drop policy if exists "avatars_auth_update" on storage.objects;
create policy "avatars_auth_update"
on storage.objects for update
using (bucket_id = 'avatars' and auth.role() = 'authenticated');
drop policy if exists "avatars_auth_delete" on storage.objects;
create policy "avatars_auth_delete"
on storage.objects for delete
using (bucket_id = 'avatars' and auth.role() = 'authenticated');

-- chat-images
drop policy if exists "chat_images_public_read" on storage.objects;
create policy "chat_images_public_read"
on storage.objects for select
using (bucket_id = 'chat-images');
drop policy if exists "chat_images_auth_write" on storage.objects;
create policy "chat_images_auth_write"
on storage.objects for insert
with check (bucket_id = 'chat-images' and auth.role() = 'authenticated');
drop policy if exists "chat_images_auth_delete" on storage.objects;
create policy "chat_images_auth_delete"
on storage.objects for delete
using (bucket_id = 'chat-images' and auth.role() = 'authenticated');

-- ============ 11) Realtime (แชท + สถานะอ่านแล้ว ไม่ต้อง refresh) ============
do $$
begin
  alter publication supabase_realtime add table public.message;
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.conversation_read;
exception when duplicate_object then
  null;
end $$;

-- ตรวจหลังรัน:
-- select tablename from pg_tables where schemaname = 'public' order by 1;
-- ต้องได้ 7 แถว: conversation, conversation_read, item, item_image, member, message, review
