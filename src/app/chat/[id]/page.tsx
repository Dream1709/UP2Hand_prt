"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/types";

interface Msg {
  message_id: string;
  message_text: string;
  created_at: string;
  sender_id: string;
}

export default function ChatRoom({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [myId, setMyId] = useState<string | null>(null);
  const [itemTitle, setItemTitle] = useState("");
  const [status, setStatus] = useState<"ok" | "reconnect">("ok");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setMyId(user.id);

      const { data: conv } = await supabase
        .from("conversation")
        .select("conversation_id, item:item_id(title)")
        .eq("conversation_id", id)
        .single();
      if (conv) setItemTitle((conv.item as unknown as { title: string })?.title ?? "");

      const { data: history } = await supabase
        .from("message")
        .select("*")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true })
        .limit(200);
      setMsgs((history ?? []) as Msg[]);

      // Realtime: รับข้อความใหม่ทันทีโดยไม่ต้อง refresh (KPI ≤1s)
      channel = supabase
        .channel(`room-${id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "message", filter: `conversation_id=eq.${id}` },
          (payload) => setMsgs((prev) => [...prev, payload.new as Msg]),
        )
        .subscribe((s) => {
          if (s === "SUBSCRIBED") setStatus("ok");
          else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") setStatus("reconnect");
        });
    };
    init();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [id, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const send = async () => {
    const t = text.trim();
    if (!t || !myId || sending) return;
    if (t.length > 2000) return;
    setSending(true);
    const supabase = createClient();
    const { error } = await supabase.from("message").insert({
      conversation_id: id,
      sender_id: myId,
      message_text: t,
    });
    if (!error) setText("");
    setSending(false);
  };

  return (
    <div className="mx-auto mt-6 flex h-[70vh] max-w-2xl flex-col rounded-3xl border bg-white">
      <div className="border-b p-4">
        <p className="font-bold">{itemTitle || "ห้องแชท"}</p>
        {status === "reconnect" && (
          <p className="text-xs text-amber-600">กำลังเชื่อมต่อระบบแชทใหม่อัตโนมัติ…</p>
        )}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {msgs.map((m) => {
          const mine = m.sender_id === myId;
          return (
            <div key={m.message_id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <p
                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  mine ? "bg-purple-700 text-white" : "bg-stone-100 text-stone-800"
                }`}
              >
                {m.message_text}
              </p>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 border-t p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="ต่อรองราคา นัดที่รับของ…"
          maxLength={2000}
          className="flex-1 rounded-full border px-4 py-2 text-sm outline-none focus:border-purple-500"
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="rounded-full bg-purple-700 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
        >
          ส่ง
        </button>
      </div>
    </div>
  );
}
