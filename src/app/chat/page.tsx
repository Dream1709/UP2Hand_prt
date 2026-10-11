"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured, timeAgo } from "@/lib/types";
import { isUnread } from "@/lib/unread";

interface Conv {
  conversation_id: string;
  created_at: string;
  item_id: string;
  member_id: string;
  buyer?: { name: string };
  item?: { title: string; price: number; seller?: { name: string } };
  other_name?: string;
  last_text?: string;
  last_sender?: string;
  last_at?: string;
  unread?: boolean;
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
        .select(
          "conversation_id, created_at, item_id, member_id, buyer:member_id(name), item:item_id(title,price,seller:member_id(name))",
        )
        .order("created_at", { ascending: false })
        .limit(50);
      const list = (data ?? []) as unknown as Conv[];
      // ดึงข้อความล่าสุดของแต่ละห้อง
      const withLast = await Promise.all(
        list.map(async (c) => {
          // คู่สนทนา: ถ้าฉันเป็น buyer → อีกฝั่งคือ seller, ถ้าไม่ใช่ → อีกฝั่งคือ buyer
          const other = user.id === c.member_id ? c.item?.seller?.name : c.buyer?.name;
          const { data: m } = await supabase
            .from("message")
            .select("message_text, message_type, sender_id, created_at")
            .eq("conversation_id", c.conversation_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          const last = m as unknown as {
            message_text: string;
            message_type?: string;
            sender_id: string;
            created_at: string;
          } | null;
          return {
            ...c,
            other_name: other ?? "",
            last_text: last ? (last.message_type === "image" ? "📷 รูปภาพ" : last.message_text) : undefined,
            last_sender: last?.sender_id,
            last_at: last?.created_at,
            unread: isUnread(c.conversation_id, last?.created_at, last?.sender_id, user.id),
          };
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
              className={`block rounded-2xl border bg-white p-4 hover:shadow ${
                c.unread ? "border-purple-300 bg-purple-50/50" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 text-base font-bold text-purple-700">
                  {c.other_name ? c.other_name.slice(0, 1).toUpperCase() : "💬"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    {c.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />}
                    <span className="truncate">{c.other_name || "คู่สนทนา"}</span>
                  </p>
                  <p className="truncate text-xs text-stone-500">{c.item?.title ?? "สินค้า"}</p>
                </div>
                <span className="shrink-0 text-xs text-stone-400">{timeAgo(c.last_at ?? c.created_at)}</span>
              </div>
              <p className={`mt-2 truncate text-sm ${c.unread ? "font-semibold text-stone-700" : "text-stone-500"}`}>
                {c.last_text ?? "เริ่มบทสนทนา"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
