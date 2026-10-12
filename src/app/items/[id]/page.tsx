"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import ChatButton from "@/components/ChatButton";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, isSupabaseConfigured, timeAgo, type Item } from "@/lib/types";

export default function ItemDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [photo, setPhoto] = useState(0);

  useEffect(() => {
    const load = async () => {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from("item")
        .select("*, member:member_id(member_id,name,email,avatar_url,role,is_banned,created_at), images:item_image(*)")
        .eq("item_id", id)
        .single();
      setItem((data as unknown as Item) ?? null);
      const { data: u } = await supabase.auth.getUser();
      setIsOwner(!!u.user && (data as unknown as Item)?.member_id === u.user.id);
      setLoading(false);
    };
    load();
  }, [id]);

  const toggleStatus = async () => {
    if (!item || !isSupabaseConfigured) return;
    setToggling(true);
    const supabase = createClient();
    const next = item.status === "available" ? "sold" : "available";
    await supabase.from("item").update({ status: next }).eq("item_id", item.item_id);
    setItem({ ...item, status: next });
    setToggling(false);
  };

  if (loading) return <p className="pt-10 text-center text-stone-500">กำลังโหลด…</p>;
  if (!item)
    return <p className="pt-10 text-center text-stone-500">ไม่พบสินค้านี้ (อาจถูกระงับ/ลบแล้ว)</p>;

  return (
    <div className="grid gap-6 pt-6 md:grid-cols-2">
      <div className="overflow-hidden rounded-3xl border bg-white">
        {(item.images?.length ?? 0) > 0 ? (
          <>
            <div className="relative bg-stone-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={item.images![Math.min(photo, item.images!.length - 1)].image_id}
                src={item.images![Math.min(photo, item.images!.length - 1)].image_url}
                alt={item.title}
                className="aspect-square w-full object-cover"
              />
              {item.images!.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="รูปก่อนหน้า"
                    onClick={() => setPhoto((p) => (p - 1 + item.images!.length) % item.images!.length)}
                    className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-lg font-bold text-white hover:bg-black/70"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="รูปถัดไป"
                    onClick={() => setPhoto((p) => (p + 1) % item.images!.length)}
                    className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-lg font-bold text-white hover:bg-black/70"
                  >
                    ›
                  </button>
                  <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-semibold text-white">
                    {Math.min(photo, item.images!.length - 1) + 1}/{item.images!.length}
                  </span>
                </>
              )}
            </div>
            {item.images!.length > 1 && (
              <div className="grid grid-cols-5 gap-2 p-3">
                {item.images!.map((im, i) => (
                  <button
                    key={im.image_id}
                    type="button"
                    onClick={() => setPhoto(i)}
                    aria-label={`ดูรูปที่ ${i + 1}`}
                    className={`aspect-square overflow-hidden rounded-xl border-2 ${
                      i === Math.min(photo, item.images!.length - 1)
                        ? "border-purple-600"
                        : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={im.image_url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex aspect-square items-center justify-center bg-stone-100 text-8xl">📦</div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-purple-100 px-3 py-1 text-lg font-bold text-purple-800">
            {formatPrice(item.price)}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs ${item.status === "available" ? "bg-green-100 text-green-700" : "bg-stone-200 text-stone-600"}`}>
            {item.status === "available" ? "ว่าง" : "ขายแล้ว"}
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-bold">{item.title}</h1>
        <p className="mt-1 text-xs text-stone-400">{timeAgo(item.created_at)}</p>
        <p className="mt-4 whitespace-pre-line text-stone-700">{item.description || "—"}</p>

        <div className="mt-6 rounded-2xl border bg-white p-4">
          <p className="text-sm text-stone-500">ผู้ขาย</p>
          <Link href={`/profile/${item.member_id}`} className="font-semibold text-purple-800 hover:underline">
            {item.member?.name ?? "—"} →
          </Link>
          <p className="text-xs text-stone-400">กดดูคะแนนรีวิวและสินค้าอื่นของผู้ขาย</p>
        </div>

        <div className="mt-4 flex gap-2">
          <ChatButton itemId={item.item_id} sellerId={item.member_id} />
          {isOwner && (
            <>
              <button
                onClick={toggleStatus}
                disabled={toggling}
                className="rounded-full border px-5 py-3 text-sm hover:bg-stone-100"
              >
                {item.status === "available" ? "ตั้งเป็นขายแล้ว" : "ตั้งเป็นว่าง"}
              </button>
              <Link href={`/sell/${item.item_id}/edit`} className="rounded-full border px-5 py-3 text-sm hover:bg-stone-100">
                แก้ไข
              </Link>
            </>
          )}
        </div>
        <p className="mt-3 text-xs text-stone-400">
          นัดรับของบริเวณ ม.พะเยาและหอพักโดยรอบ · ชำระเงินตกลงกันเอง (ไม่มี escrow)
        </p>
      </div>
    </div>
  );
}
