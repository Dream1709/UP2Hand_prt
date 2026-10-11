"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import ReviewForm from "@/components/ReviewForm";
import Stars from "@/components/Stars";
import { createClient } from "@/lib/supabase/client";
import {
  ACCEPTED_TYPES,
  MAX_FILE_MB,
  isSupabaseConfigured,
  timeAgo,
  type Item,
  type Member,
} from "@/lib/types";

interface Review {
  review_id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer_id: string;
  reviewer?: { name: string };
}

export default function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [member, setMember] = useState<Member | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isMe, setIsMe] = useState(false);
  const [loading, setLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarErr, setAvatarErr] = useState<string | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);

  const uploadAvatar = async (file: File) => {
    setAvatarErr(null);
    if (!ACCEPTED_TYPES.includes(file.type) || file.size > MAX_FILE_MB * 1024 * 1024) {
      setAvatarErr("ขนาดไฟล์ต้องไม่เกิน 5MB และรองรับเฉพาะ JPG, PNG, WebP");
      return;
    }
    setAvatarUploading(true);
    try {
      const supabase = createClient();
      const path = `${id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: dbErr } = await supabase
        .from("member")
        .update({ avatar_url: pub.publicUrl })
        .eq("member_id", id);
      if (dbErr) throw dbErr;
      setMember((prev) => (prev ? { ...prev, avatar_url: pub.publicUrl } : prev));
    } catch (e: unknown) {
      setAvatarErr(e instanceof Error ? e.message : "อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setAvatarUploading(false);
      if (avatarRef.current) avatarRef.current.value = "";
    }
  };

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    const { data: m } = await supabase.from("member").select("*").eq("member_id", id).single();
    setMember((m as unknown as Member) ?? null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const me = user?.id === id;
    setIsMe(me);
    // เจ้าของดูโปรไฟล์ตัวเอง → เห็นของทุกสถานะ (RLS ให้สิทธิ์อยู่แล้ว)
    // คนอื่น/guest → เห็นเฉพาะของว่าง
    let itemQuery = supabase
      .from("item")
      .select("*, images:item_image(*)")
      .eq("member_id", id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!me) itemQuery = itemQuery.eq("status", "available");
    const { data: it } = await itemQuery;
    setItems(((it ?? []) as unknown as Item[]));
    const { data: rv } = await supabase
      .from("review")
      .select("*, reviewer:reviewer_id(name)")
      .eq("reviewee_id", id)
      .order("created_at", { ascending: false })
      .limit(30);
    setReviews(((rv ?? []) as unknown as Review[]));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    const init = async () => {
      await load();
    };
    init();
  }, [load]);

  if (!isSupabaseConfigured)
    return <p className="pt-10 text-center text-stone-500">ตั้งค่า Supabase ก่อนดูโปรไฟล์</p>;
  if (loading) return <p className="pt-10 text-center text-stone-500">กำลังโหลด…</p>;
  if (!member) return <p className="pt-10 text-center text-stone-500">ไม่พบผู้ใช้คนนี้</p>;

  const avg = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  const STATUS_LABEL: Record<string, string> = {
    available: "ว่าง",
    sold: "ขายแล้ว",
    suspended: "ถูกระงับ",
  };
  const STATUS_STYLE: Record<string, string> = {
    available: "bg-green-100 text-green-700",
    sold: "bg-stone-200 text-stone-600",
    suspended: "bg-amber-100 text-amber-800",
  };
  const countBy = (s: string) => items.filter((it) => it.status === s).length;

  return (
    <div className="mx-auto mt-6 max-w-3xl">
      <div className="rounded-3xl border bg-white p-6 text-center">
        <div className="relative mx-auto h-16 w-16">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-purple-100 text-2xl font-bold text-purple-700">
            {member.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={member.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              member.name.slice(0, 1).toUpperCase()
            )}
          </div>
          {isMe && (
            <>
              <input
                ref={avatarRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadAvatar(f);
                }}
              />
              <button
                type="button"
                onClick={() => avatarRef.current?.click()}
                disabled={avatarUploading}
                title="เปลี่ยนรูปโปรไฟล์"
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border bg-white text-sm shadow hover:bg-stone-100 disabled:opacity-50"
              >
                {avatarUploading ? "⏳" : "📷"}
              </button>
            </>
          )}
        </div>
        {avatarErr && <p className="mt-2 text-xs text-red-600">{avatarErr}</p>}
        <h1 className="mt-2 text-xl font-bold">{member.name}</h1>
        <div className="mt-1 flex items-center justify-center gap-2">
          <Stars value={avg} />
          <span className="text-sm text-stone-500">
            {reviews.length ? `${avg.toFixed(1)} (${reviews.length} รีวิว)` : "ยังไม่มีรีวิว"}
          </span>
        </div>
      </div>

      {!isMe && <div className="mt-4"><ReviewForm revieweeId={id} onDone={load} /></div>}

      <h2 className="mt-6 font-semibold">
        {isMe ? `สินค้าของฉัน (${items.length})` : `สินค้าที่กำลังขาย (${items.length})`}
      </h2>
      {isMe && items.length > 0 && (
        <p className="mt-1 text-xs text-stone-500">
          ว่าง {countBy("available")} · ขายแล้ว {countBy("sold")}
          {countBy("suspended") > 0 && ` · ถูกระงับ ${countBy("suspended")}`}
        </p>
      )}
      {items.length === 0 ? (
        <p className="mt-2 rounded-2xl border bg-white p-6 text-center text-sm text-stone-400">
          {isMe ? "คุณยังไม่มีประกาศ — กดปุ่ม + ลงขายเพื่อเริ่มเลย!" : "ยังไม่มีสินค้าที่กำลังขาย"}
        </p>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-3">
          {items.map((it) => (
            <div key={it.item_id} className="overflow-hidden rounded-2xl border bg-white hover:shadow">
              <Link href={`/items/${it.item_id}`} className="block">
                {it.images?.[0]?.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.images[0].image_url} alt={it.title} className="aspect-square w-full object-cover" />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-stone-100 text-4xl">📦</div>
                )}
                <div className="p-3">
                  <p className="line-clamp-1 text-sm font-semibold hover:text-purple-800">{it.title}</p>
                  <p className="mt-0.5 text-xs text-stone-500">{Number(it.price) === 0 ? "แจกฟรี" : `฿${Number(it.price).toLocaleString("th-TH")}`}</p>
                </div>
              </Link>
              {isMe && (
                <div className="flex items-center gap-2 px-3 pb-3">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_STYLE[it.status] ?? "bg-stone-100 text-stone-600"}`}>
                    {STATUS_LABEL[it.status] ?? it.status}
                  </span>
                  <Link href={`/sell/${it.item_id}/edit`} className="ml-auto text-xs font-semibold text-purple-700 hover:underline">
                    แก้ไข
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <h2 className="mt-6 font-semibold">รีวิว ({reviews.length})</h2>
      <div className="mt-2 space-y-2">
        {reviews.map((r) => (
          <div key={r.review_id} className="rounded-2xl border bg-white p-4">
            <div className="flex items-center justify-between">
              <Stars value={r.rating} size="sm" />
              <span className="text-xs text-stone-400">{timeAgo(r.created_at)}</span>
            </div>
            <p className="mt-1 text-sm">{r.comment || "—"}</p>
            <p className="mt-1 text-xs text-stone-400">โดย {r.reviewer?.name ?? "ผู้ซื้อ"}</p>
          </div>
        ))}
        {reviews.length === 0 && (
          <p className="rounded-2xl border bg-white p-6 text-center text-sm text-stone-400">ยังไม่มีรีวิว</p>
        )}
      </div>
    </div>
  );
}
