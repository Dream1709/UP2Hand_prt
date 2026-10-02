-- UP 2 Hand — Storage (bucket item-images)
-- Run after schema.sql

insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do nothing;

-- อ่านรูปได้ทุกคน (open browsing)
drop policy if exists "item_images_public_read" on storage.objects;
create policy "item_images_public_read"
on storage.objects for select
using (bucket_id = 'item-images');

-- อัปโหลด/ลบได้เฉพาะ user ที่ login, ไฟล์ต้องเป็นรูป ≤5MB
drop policy if exists "item_images_auth_write" on storage.objects;
create policy "item_images_auth_write"
on storage.objects for insert
with check (
  bucket_id = 'item-images'
  and auth.role() = 'authenticated'
);

drop policy if exists "item_images_auth_delete" on storage.objects;
create policy "item_images_auth_delete"
on storage.objects for delete
using (
  bucket_id = 'item-images'
  and auth.role() = 'authenticated'
);

-- NOTE: จำกัดชนิดไฟล์ (JPG/PNG/WebP) และขนาด ≤5MB ทำที่ฝั่ง Next.js
-- ก่อน upload (client-side validation) ตาม Acceptance Criteria 10.2
