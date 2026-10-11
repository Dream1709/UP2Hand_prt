-- UP 2 Hand — Storage (bucket avatars: รูปโปรไฟล์)
-- Run after storage.sql

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- อ่านรูปได้ทุกคน (โชว์บนโปรไฟล์/ฟีด)
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
on storage.objects for select
using (bucket_id = 'avatars');

-- อัปโหลด/อัปเดต/ลบได้เฉพาะ user ที่ login
drop policy if exists "avatars_auth_write" on storage.objects;
create policy "avatars_auth_write"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and auth.role() = 'authenticated'
);

drop policy if exists "avatars_auth_update" on storage.objects;
create policy "avatars_auth_update"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and auth.role() = 'authenticated'
);

drop policy if exists "avatars_auth_delete" on storage.objects;
create policy "avatars_auth_delete"
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and auth.role() = 'authenticated'
);

-- NOTE: จำกัดชนิดไฟล์ (JPG/PNG/WebP) และขนาด ≤5MB ทำที่ฝั่ง Next.js
-- ก่อน upload (client-side validation) เหมือนรูปสินค้า/รูปแชท
