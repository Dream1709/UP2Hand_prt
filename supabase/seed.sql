-- Seed ตัวอย่าง (รันหลัง schema.sql) — ใช้โชว์ Feed โดยไม่ต้อง login
-- หมายเหตุ: member seed ใช้ id สมมติ, ของจริงจะถูกสร้างจาก auth.users ผ่าน trigger

insert into public.member (member_id, name, email, avatar_url, role)
values
  ('11111111-1111-1111-1111-111111111111', 'รุ่นพี่หอใน', 'senior@up.ac.th', null, 'member'),
  ('22222222-2222-2222-2222-222222222222', 'น้องปี 1', 'freshy@up.ac.th', null, 'member')
on conflict (member_id) do nothing;

insert into public.item (item_id, title, description, price, status, member_id, created_at)
values
  ('a0000000-0000-0000-0000-000000000001', 'พัดลมตั้งโต๊ะ 16 นิ้ว', 'ใช้งาน 1 เทอม ย้ายหอเลยขาย นัดรับหอในได้', 350, 'available', '11111111-1111-1111-1111-111111111111', now() - interval '2 hours'),
  ('a0000000-0000-0000-0000-000000000002', 'ตู้เย็น mini 3.5 คิว', 'เย็นปกติ ประกันเหลือ นัดรับหน้ามอ', 2500, 'available', '11111111-1111-1111-1111-111111111111', now() - interval '1 day'),
  ('a0000000-0000-0000-0000-000000000003', 'หนังสือ Calculus แจกฟรี', 'ขีดเขียนนิดหน่อย มารับเองที่คณะ ICT', 0, 'available', '22222222-2222-2222-2222-222222222222', now() - interval '3 days'),
  ('a0000000-0000-0000-0000-000000000004', 'โต๊ะพับ + ชั้นวางของ', 'ขายยกเซ็ต ย้ายหอ', 500, 'sold', '22222222-2222-2222-2222-222222222222', now() - interval '5 days')
on conflict (item_id) do nothing;
