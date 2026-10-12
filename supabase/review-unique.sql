-- UP 2 Hand — กันรีวิวซ้ำ (1 คนรีวิวอีกคนได้ครั้งเดียว)
-- Run ONCE in Supabase SQL Editor.
-- ตรงกับ Acceptance Criteria 10.5: รีวิวซ้ำ → "คุณได้ให้คะแนนผู้ใช้คนนี้ไปแล้ว"

-- 1) ลบแถวซ้ำเก่า (เก็บแถวล่าสุดของแต่ละคู่ไว้) — ถ้าไม่มีแถวซ้ำ ขั้นนี้ไม่กระทบอะไร
delete from public.review a
using public.review b
where a.review_id < b.review_id
  and a.reviewer_id = b.reviewer_id
  and a.reviewee_id = b.reviewee_id;

-- 2) ห้ามคู่ซ้ำระดับฐานข้อมูล (กันพลาดแม้มีคนยิง API ตรง)
alter table public.review
  add constraint unique_reviewer_reviewee unique (reviewer_id, reviewee_id);
