"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import ChatButton from "@/components/ChatButton";
import { MOCK_ITEMS } from "@/lib/mock";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, isSupabaseConfigured, timeAgo, type Item } from "@/lib/types";

export default function ItemDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!isSupabaseConfigured) {
        setItem(MOCK_ITEMS.find((i) => i.item_id === id) ?? MOCK_ITEMS[0]);
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
        {item.images?.[0]?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.images[0].image_url} alt={item.title} className="aspect-square w-full object-cover" />
        ) : (
          <div className="flex aspect-square items-center justify-center bg-stone-100 text-8xl">📦</div>
        )}
        {(item.images?.length ?? 0) > 1 && (
          <div className="grid grid-cols-5 gap-2 p-3">
            {item.images!.slice(1).map((im) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={im.image_id} src={im.image_url} alt="" className="aspect-square rounded-xl object-cover" />
            ))}
          </div>
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
