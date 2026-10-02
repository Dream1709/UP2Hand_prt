-- UP 2 Hand — Realtime (Phase B)
-- Run in Supabase SQL Editor to enable live chat without refresh.

-- เปิด Realtime ให้ตาราง message (ต้องทำครั้งเดียว)
alter publication supabase_realtime add table public.message;

-- NOTE: ถ้าเคย add แล้วจะ error "already a member" — ข้ามได้
-- เช็คสถานะ: select * from pg_publication_tables where pubname = 'supabase_realtime';
