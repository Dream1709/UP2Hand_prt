"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FeedCard from "@/components/FeedCard";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured, type Item } from "@/lib/types";

type ByFilter = "all" | "title" | "desc";

const FILTERS: { key: ByFilter; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "title", label: "ชื่อสินค้า" },
  { key: "desc", label: "รายละเอียด" },
];

function validBy(v: string | null): ByFilter {
  return v === "title" || v === "desc" ? v : "all";
}

function SearchInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") ?? "").trim();
  const by = validBy(searchParams.get("by"));
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const noBackend = !isSupabaseConfigured;

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      let query = supabase
        .from("item")
        .select("*, member:member_id(member_id,name,email,avatar_url,role,is_banned,created_at), images:item_image(*)")
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(60);
      if (q) {
        const pattern = `%${q}%`;
        if (by === "title") query = query.ilike("title", pattern);
        else if (by === "desc") query = query.ilike("description", pattern);
        else query = query.or(`title.ilike.${pattern},description.ilike.${pattern}`);
      }
      const { data } = await query;
      if (cancelled) return;
      setItems(((data ?? []) as unknown as Item[]).filter(Boolean));
      setLoading(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [q, by]);

  const setBy = (next: ByFilter) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    p.set("by", next);
    router.push(`/search?${p.toString()}`);
  };

  return (
    <div className="pt-6">
      <div className="rounded-3xl bg-gradient-to-r from-purple-800 via-purple-700 to-purple-900 p-6 text-white sm:p-8">
        <h1 className="text-2xl font-bold sm:text-3xl">
          ผลค้นหา {q ? `"${q}"` : ""} {loading ? "…" : `(${items.length})`}
        </h1>
        <p className="mt-1 text-sm text-purple-100">
          เลือกขอบเขตการค้นหา: ชื่อสินค้า หรือรายละเอียดเพิ่มเติม
        </p>
        <div className="mt-4 flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setBy(f.key)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                by === f.key
                  ? "bg-amber-300 text-purple-900"
                  : "bg-white/15 text-white hover:bg-white/25"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {noBackend && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-xs text-red-700">
          ยังไม่ตั้งค่า Supabase — สร้าง .env.local จาก .env.example ตาม supabase/README.md แล้ว restart
        </p>
      )}

      {items.length === 0 && !loading ? (
        <div className="mt-6 rounded-2xl border bg-white p-10 text-center text-stone-500">
          ไม่พบสินค้าที่คุณกำลังค้นหา
          <p className="mt-1 text-xs text-stone-400">ลองเปลี่ยนคำค้น หรือสลับไปค้นแบบทั้งหมด</p>
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

export default function SearchPage() {
  return (
    <Suspense>
      <SearchInner />
    </Suspense>
  );
}
