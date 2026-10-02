export type Role = "member" | "admin";
export type ItemStatus = "available" | "sold" | "suspended";

export interface Member {
  member_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: Role;
  is_banned: boolean;
  created_at: string;
}

export interface ItemImage {
  image_id: string;
  image_url: string;
  created_at: string;
  item_id: string;
}

export interface Item {
  item_id: string;
  title: string;
  description: string;
  price: number;
  status: ItemStatus;
  created_at: string;
  member_id: string;
  member?: Member;
  images?: ItemImage[];
}

export const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const UP_DOMAIN = "@up.ac.th";
export const isUpMail = (email?: string | null) =>
  !!email && email.toLowerCase().endsWith(UP_DOMAIN);

export const MAX_IMAGES = 5;
export const MAX_FILE_MB = 5;
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function formatPrice(price: number): string {
  if (Number(price) === 0) return "แจกฟรี";
  return `฿${Number(price).toLocaleString("th-TH")}`;
}

export function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "เมื่อสักครู่";
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชม.ที่แล้ว`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days} วันที่แล้ว`;
  return new Date(iso).toLocaleDateString("th-TH");
}
