// ตัวช่วย "อ่านแล้ว" ของแชท — เก็บเวลาอ่านล่าสุดต่อห้องใน localStorage (รายอุปกรณ์)
// เทียบด้วย timestamp ตัวเลข กันฟอร์แมต timezone ต่างกัน

const key = (convId: string) => `up2hand-read-${convId}`;

export function getReadTime(convId: string): number | null {
  try {
    const v = localStorage.getItem(key(convId));
    if (!v) return null;
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  } catch {
    return null;
  }
}

export function setReadTime(convId: string, iso?: string) {
  try {
    localStorage.setItem(key(convId), iso ?? new Date().toISOString());
  } catch {
    // private mode — ข้าม
  }
}

/** true = มีข้อความใหม่ที่อีกฝั่งส่งมาหลังเวลาอ่านล่าสุด */
export function isUnread(
  convId: string,
  lastCreatedAt: string | null | undefined,
  lastSenderId: string | null | undefined,
  myId: string | null,
): boolean {
  if (!lastCreatedAt || !myId) return false;
  if (lastSenderId === myId) return false; // ข้อความล่าสุดเป็นของเราเอง
  const read = getReadTime(convId);
  if (read === null) return false; // ยังไม่เคยเปิดห้องนี้ → ไม่นับย้อนหลัง
  return Date.parse(lastCreatedAt) > read;
}
