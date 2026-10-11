"use client";

import { useEffect, useState } from "react";
import FeedCard from "@/components/FeedCard";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured, type Item } from "@/lib/types";

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const noBackend = !isSupabaseConfigured;

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    const fetchItems = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("item")
        .select("*, member:member_id(member_id,name,email,avatar_url,role,is_banned,created_at), images:item_image(*)")
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(60);
      if (cancelled) return;
      setItems(((data ?? []) as unknown as Item[]).filter(Boolean));
      setLoading(false);
    };
    fetchItems();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="pt-6">
      <div className="rounded-3xl bg-gradient-to-r from-purple-800 via-purple-700 to-purple-900 p-6 text-white sm:p-8">
        <h1 className="text-2xl font-bold sm:text-3xl">
          ตลาดมือสอง ม.พะเยา 🏕️
        </h1>
        <p className="mt-1 text-sm text-purple-100">
          เปิดดูได้เลยไม่ต้อง login · พิมพ์ค้นหาที่แถบบนได้ทุกหน้า · ลงขาย แชท รีวิว ต้องใช้ @up.ac.th
        </p>
      </div>

      {noBackend && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-xs text-red-700">
          ยังไม่ตั้งค่า Supabase — สร้าง .env.local จาก .env.example ตาม supabase/README.md แล้ว restart
        </p>
      )}

      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-semibold">
          สินค้าล่าสุด {loading ? "…" : `(${items.length})`}
        </h2>
        <span className="text-xs text-stone-500">เรียงใหม่ → เก่า · ไม่ปิดกั้น</span>
      </div>

      {items.length === 0 && !loading ? (
        <div className="mt-6 rounded-2xl border bg-white p-10 text-center text-stone-500">
          ยังไม่มีสินค้า — เป็นคนแรกที่ลงขายเลย!
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <FeedCard key={it.item_id} item={it} />
          ))}
        </div>
      )}
    </div>
  );
}
