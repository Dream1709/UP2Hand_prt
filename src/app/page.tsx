"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FeedCard from "@/components/FeedCard";
import Pager from "@/components/Pager";
import { createClient } from "@/lib/supabase/client";
import { PAGE_SIZE, isSupabaseConfigured, parsePage, type Item } from "@/lib/types";

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = parsePage(searchParams.get("page"));
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const noBackend = !isSupabaseConfigured;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    const fetchItems = async () => {
      setLoading(true);
      const supabase = createClient();
      const from = (page - 1) * PAGE_SIZE;
      const { data, count } = await supabase
        .from("item")
        .select(
          "*, member:member_id(member_id,name,email,avatar_url,role,is_banned,created_at), images:item_image(*)",
          { count: "exact" },
        )
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (cancelled) return;
      setItems(((data ?? []) as unknown as Item[]).filter(Boolean));
      setTotal(count ?? 0);
      setLoading(false);
    };
    fetchItems();
    return () => {
      cancelled = true;
    };
  }, [page]);

  const go = (p: number) => {
    router.push(p <= 1 ? "/" : `/?page=${p}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
          สินค้าล่าสุด {loading ? "…" : `(${total})`}
        </h2>
        <span className="text-xs text-stone-500">เรียงใหม่ → เก่า · ไม่ปิดกั้น</span>
      </div>

      {items.length === 0 && !loading ? (
        <div className="mt-6 rounded-2xl border bg-white p-10 text-center text-stone-500">
          {page > 1 ? "หน้านี้ไม่มีสินค้าแล้ว" : "ยังไม่มีสินค้า — เป็นคนแรกที่ลงขายเลย!"}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <FeedCard key={it.item_id} item={it} />
          ))}
        </div>
      )}

      {!loading && <Pager page={Math.min(page, totalPages)} totalPages={totalPages} onGo={go} />}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeInner />
    </Suspense>
  );
}
