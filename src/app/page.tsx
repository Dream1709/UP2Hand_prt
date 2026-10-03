"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import FeedCard from "@/components/FeedCard";
import { MOCK_ITEMS } from "@/lib/mock";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured, type Item } from "@/lib/types";

function HomeInner() {
  const searchParams = useSearchParams();
  const paramQ = searchParams.get("q") ?? "";
  // ซิงก์ช่องค้นหาใน Navbar (?q=) เข้ากับฟีด — render-phase pattern
  const [q, setQ] = useState(paramQ);
  const [prevParam, setPrevParam] = useState(paramQ);
  if (paramQ !== prevParam) {
    setPrevParam(paramQ);
    setQ(paramQ);
  }
  const [debounced, setDebounced] = useState(paramQ);
  const [remoteItems, setRemoteItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const usingMock = !isSupabaseConfigured;

  const mockFiltered = useMemo(
    () =>
      MOCK_ITEMS.filter((i) =>
        debounced ? i.title.includes(debounced) : true,
      ),
    [debounced],
  );

  const items = usingMock ? mockFiltered : remoteItems;

  // Debounce 300ms ตาม Acceptance Criteria 10.3
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    const fetchItems = async () => {
      setLoading(true);
      const supabase = createClient();
      let query = supabase
        .from("item")
        .select("*, member:member_id(member_id,name,email,avatar_url,role,is_banned,created_at), images:item_image(*)")
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(60);
      if (debounced) query = query.ilike("title", `%${debounced}%`);
      const { data } = await query;
      if (cancelled) return;
      setRemoteItems(((data ?? []) as unknown as Item[]).filter(Boolean));
      setLoading(false);
    };
    fetchItems();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const count = items.length;

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

      {usingMock && (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-2 text-xs text-amber-800">
          โหมดตัวอย่าง (ยังไม่ตั้งค่า Supabase) — ตั้งค่าตาม supabase/README.md แล้ว
          refresh เพื่อดูข้อมูลจริง · สร้าง .env.local จาก .env.example
        </p>
      )}

      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-semibold">
          {debounced ? `ผลค้นหา "${debounced}"` : "สินค้าล่าสุด"} {loading ? "…" : `(${count})`}
        </h2>
        <span className="text-xs text-stone-500">เรียงใหม่ → เก่า · ไม่ปิดกั้น</span>
      </div>

      {items.length === 0 && !loading ? (
        <div className="mt-6 rounded-2xl border bg-white p-10 text-center text-stone-500">
          ไม่พบสินค้าที่คุณกำลังค้นหา
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

export default function Home() {
  return (
    <Suspense>
      <HomeInner />
    </Suspense>
  );
}
