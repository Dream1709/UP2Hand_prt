"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured, timeAgo } from "@/lib/types";

interface Conv {
  conversation_id: string;
  created_at: string;
  item_id: string;
  member_id: string;
  item?: { title: string; price: number };
  last_text?: string;
}

export default function ChatInbox() {
  const router = useRouter();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      // ห้องที่ฉันเป็น buyer หรือเป็น seller (ผ่าน item.member_id)
      const { data } = await supabase
        .from("conversation")
        .select("conversation_id, created_at, item_id, member_id, item:item_id(title,price)")
        .order("created_at", { ascending: false })
        .limit(50);
      const list = (data ?? []) as unknown as Conv[];
      // ดึงข้อความล่าสุดของแต่ละห้อง
      const withLast = await Promise.all(
        list.map(async (c) => {
          const { data: m } = await supabase
            .from("message")
            .select("message_text")
            .eq("conversation_id", c.conversation_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          return { ...c, last_text: m?.message_text };
        }),
      );
      setConvs(withLast);
      setLoading(false);
    };
    load();
  }, [router]);

  if (loading) return <p className="pt-10 text-center text-stone-500">กำลังโหลดห้องแชท…</p>;

  if (!isSupabaseConfigured)
    return <p className="pt-10 text-center text-stone-500">ตั้งค่า Supabase ก่อนใช้แชท</p>;

  return (
    <div className="mx-auto mt-6 max-w-2xl">
      <h1 className="text-xl font-bold">กล่องข้อความ 💬</h1>
      {convs.length === 0 ? (
        <div className="mt-4 rounded-2xl border bg-white p-10 text-center text-stone-500">
          ยังไม่มีบทสนทนา — กดปุ่มทักแชทที่หน้าสินค้าเพื่อเริ่มคุย
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {convs.map((c) => (
            <Link
              key={c.conversation_id}
              href={`/chat/${c.conversation_id}`}
              className="block rounded-2xl border bg-white p-4 hover:shadow"
            >
              <p className="font-semibold">{c.item?.title ?? "สินค้า"}</p>
              <p className="truncate text-sm text-stone-500">{c.last_text ?? "เริ่มบทสนทนา"}</p>
              <p className="mt-1 text-xs text-stone-400">{timeAgo(c.created_at)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
