"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FeedCard from "@/components/FeedCard";
import Pager from "@/components/Pager";
import { createClient } from "@/lib/supabase/client";
import { PAGE_SIZE, isSupabaseConfigured, parsePage, type Item } from "@/lib/types";

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
  const page = parsePage(searchParams.get("page"));
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const noBackend = !isSupabaseConfigured;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const from = (page - 1) * PAGE_SIZE;
      let query = supabase
        .from("item")
        .select("*, member:member_id(member_id,name,email,avatar_url,role,is_banned,created_at), images:item_image(*)", { count: "exact" })
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (q) {
        const pattern = `%${q}%`;
        if (by === "title") query = query.ilike("title", pattern);
        else if (by === "desc") query = query.ilike("description", pattern);
        else query = query.or(`title.ilike.${pattern},description.ilike.${pattern}`);
      }
      const { data, count } = await query;
      if (cancelled) return;
      setItems(((data ?? []) as unknown as Item[]).filter(Boolean));
      setTotal(count ?? 0);
      setLoading(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [q, by, page]);

  const setBy = (next: ByFilter) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    p.set("by", next);
    router.push(`/search?${p.toString()}`);
  };

  const go = (next: number) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    p.set("by", by);
    if (next > 1) p.set("page", String(next));
    router.push(`/search?${p.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="pt-6">
      <div className="rounded-3xl bg-gradient-to-r from-purple-800 via-purple-700 to-purple-900 p-6 text-white sm:p-8">
        <h1 className="text-2xl font-bold sm:text-3xl">
          ผลค้นหา {q ? `"${q}"` : ""} {loading ? "…" : `(${total})`}
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

      {!loading && <Pager page={Math.min(page, totalPages)} totalPages={totalPages} onGo={go} />}
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
