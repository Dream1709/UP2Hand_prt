-- UP 2 Hand — Schema (Phase A)
-- Run in Supabase SQL Editor. Postgres 15.
-- ER: MEMBER, ITEM, ITEM_IMAGE, CONVERSATION, MESSAGE, REVIEW

-- Extensions
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ============ MEMBER ============
create table if not exists public.member (
  member_id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  avatar_url text,
  role text not null default 'member' check (role in ('member','admin')),
  is_banned boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============ ITEM ============
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

-- ============ ITEM_IMAGE ============
create table if not exists public.item_image (
  image_id uuid primary key default gen_random_uuid(),
  image_url text not null,
  created_at timestamptz not null default now(),
  item_id uuid not null references public.item(item_id) on delete cascade
);
create index if not exists idx_item_image_item on public.item_image(item_id);

-- ============ CONVERSATION (Phase B, สร้างไว้ก่อน) ============
create table if not exists public.conversation (
  conversation_id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  item_id uuid not null references public.item(item_id) on delete cascade,
  member_id uuid not null references public.member(member_id) on delete cascade,
  unique (item_id, member_id)
);
create index if not exists idx_conv_item on public.conversation(item_id);
create index if not exists idx_conv_member on public.conversation(member_id);

-- ============ MESSAGE (Phase B) ============
create table if not exists public.message (
  message_id uuid primary key default gen_random_uuid(),
  message_text text not null check (char_length(message_text) between 1 and 2000),
  created_at timestamptz not null default now(),
  conversation_id uuid not null references public.conversation(conversation_id) on delete cascade,
  sender_id uuid not null references public.member(member_id) on delete cascade
);
create index if not exists idx_msg_conv_created on public.message(conversation_id, created_at);

-- ============ REVIEW (Phase B) ============
create table if not exists public.review (
  review_id uuid primary key default gen_random_uuid(),
  rating int not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  reviewer_id uuid not null references public.member(member_id) on delete cascade,
  reviewee_id uuid not null references public.member(member_id) on delete cascade,
  check (reviewer_id <> reviewee_id)
);
create index if not exists idx_review_reviewee on public.review(reviewee_id, created_at desc);
create index if not exists idx_review_reviewer on public.review(reviewer_id);

-- ============ Auto-create member on signup ============
-- ผูก auth.users.id เข้ากับ member.member_id ผ่าน trigger
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

-- ============ RLS ============
alter table public.member enable row level security;
alter table public.item enable row level security;
alter table public.item_image enable row level security;
alter table public.conversation enable row level security;
alter table public.message enable row level security;
alter table public.review enable row level security;

-- helper: is_admin()
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.member where member_id = auth.uid() and role = 'admin') $$;

-- MEMBER: ทุกคนอ่านได้ (โชว์ชื่อผู้ขาย), เขียนได้เฉพาะตัวเอง, admin ได้หมด
drop policy if exists "member_read_all" on public.member;
create policy "member_read_all" on public.member for select using (true);
drop policy if exists "member_update_own" on public.member;
create policy "member_update_own" on public.member for update using (auth.uid() = member_id);
drop policy if exists "member_admin_all" on public.member;
create policy "member_admin_all" on public.member for all using (public.is_admin());

-- ITEM: guest อ่านเฉพาะ available; member เห็นของตัวเองทุกสถานะ + available ของคนอื่น; admin เห็นหมด
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

-- ITEM_IMAGE: อ่านตาม item ที่มองเห็นได้ (อย่างง่าย: เปิดอ่าน available + ของตัวเอง)
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

-- Phase B policies (เปิดกว้างแบบปลอดภัยขั้นต้น)
drop policy if exists "conv_all_owner" on public.conversation;
create policy "conv_all_owner" on public.conversation for all using (
  auth.uid() = member_id
  or exists (select 1 from public.item where item.item_id = conversation.item_id and item.member_id = auth.uid())
  or public.is_admin()
);
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
drop policy if exists "review_read_all" on public.review;
create policy "review_read_all" on public.review for select using (true);
drop policy if exists "review_insert_own" on public.review;
create policy "review_insert_own" on public.review for insert with check (auth.uid() = reviewer_id);
