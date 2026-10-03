# Supabase Setup — UP 2 Hand (ทำครั้งเดียว)

## 1. สร้าง Project
1. https://supabase.com → New project → จด `Project URL` + `anon public key`
2. ในโปรเจกต์ Next.js สร้างไฟล์ `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 2. รัน SQL
Supabase Dashboard → SQL Editor → รันตามลำดับ:
1. `supabase/schema.sql`
2. `supabase/storage.sql`
3. `supabase/realtime.sql` — เปิด Realtime ให้ตาราง message (แชท Phase B)
4. `supabase/chat-upgrade.sql` — เวลา/อ่านแล้ว/ส่งรูป (message_type, conversation_read, bucket chat-images)
5. (ทางเลือก) `supabase/seed.sql` — ข้อมูลตัวอย่าง

## 3. Google OAuth (บังคับ @up.ac.th ฝั่งโค้ด)
1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client (Web)
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
2. Supabase → Authentication → Providers → Google → Enable + วาง Client ID/Secret
3. Supabase → Authentication → URL Configuration → Site URL = `NEXT_PUBLIC_SITE_URL`
   - Redirect URLs เพิ่ม `http://localhost:3000/auth/callback` และ URL production บน Vercel
4. โค้ดจะตรวจโดเมนหลัง login: ถ้า email ไม่ลงท้าย `@up.ac.th` → signOut + แสดง
   "อนุญาตเฉพาะบุคลากรและนิสิต ม.พะเยา (@up.ac.th) เท่านั้น"

## 4. ตั้ง Admin คนแรก
1. login ด้วยเมล @up.ac.th ของแอดมิน 1 ครั้ง (เพื่อให้ trigger สร้าง row ใน member)
2. Table Editor → `member` → หา email ตัวเอง → แก้ `role` = `admin`

## 5. แบนผู้ใช้
- ตั้ง `member.is_banned = true` → middleware + callback จะบล็อกไม่ให้เข้า
  พร้อมข้อความ "บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ"

## 6. Deploy (Vercel)
- ใส่ Env 3 ตัวเดียวกันใน Vercel → Deploy
- กลับมาเพิ่ม Redirect URL ของ production ใน Supabase
