"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import ReviewForm from "@/components/ReviewForm";
import Stars from "@/components/Stars";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured, timeAgo, type Item, type Member } from "@/lib/types";

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

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    const { data: m } = await supabase.from("member").select("*").eq("member_id", id).single();
    setMember((m as unknown as Member) ?? null);
    const { data: it } = await supabase
      .from("item")
      .select("*, images:item_image(*)")
      .eq("member_id", id)
      .eq("status", "available")
      .order("created_at", { ascending: false })
      .limit(20);
    setItems(((it ?? []) as unknown as Item[]));
    const { data: rv } = await supabase
      .from("review")
      .select("*, reviewer:reviewer_id(name)")
      .eq("reviewee_id", id)
      .order("created_at", { ascending: false })
      .limit(30);
    setReviews(((rv ?? []) as unknown as Review[]));
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setIsMe(user?.id === id);
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

  return (
    <div className="mx-auto mt-6 max-w-3xl">
      <div className="rounded-3xl border bg-white p-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 text-2xl font-bold text-purple-700">
          {member.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={member.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            member.name.slice(0, 1).toUpperCase()
          )}
        </div>
        <h1 className="mt-2 text-xl font-bold">{member.name}</h1>
        <div className="mt-1 flex items-center justify-center gap-2">
          <Stars value={avg} />
          <span className="text-sm text-stone-500">
            {reviews.length ? `${avg.toFixed(1)} (${reviews.length} รีวิว)` : "ยังไม่มีรีวิว"}
          </span>
        </div>
      </div>

      {!isMe && <div className="mt-4"><ReviewForm revieweeId={id} onDone={load} /></div>}

      <h2 className="mt-6 font-semibold">สินค้าที่กำลังขาย ({items.length})</h2>
      <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-3">
        {items.map((it) => (
          <Link key={it.item_id} href={`/items/${it.item_id}`} className="rounded-2xl border bg-white p-3 hover:shadow">
            <p className="line-clamp-1 text-sm font-semibold">{it.title}</p>
            <p className="text-xs text-stone-500">{Number(it.price) === 0 ? "แจกฟรี" : `฿${Number(it.price).toLocaleString("th-TH")}`}</p>
          </Link>
        ))}
      </div>

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
