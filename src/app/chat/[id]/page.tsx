"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ACCEPTED_TYPES, MAX_FILE_MB, isSupabaseConfigured } from "@/lib/types";
import { setReadTime } from "@/lib/unread";

interface Msg {
  message_id: string;
  message_text: string;
  message_type: "text" | "image";
  image_url: string | null;
  created_at: string;
  sender_id: string;
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatRoom({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [myId, setMyId] = useState<string | null>(null);
  const [itemTitle, setItemTitle] = useState("");
  const [otherName, setOtherName] = useState("");
  const [otherReadAt, setOtherReadAt] = useState<number | null>(null);
  const [status, setStatus] = useState<"ok" | "reconnect">("ok");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imgErr, setImgErr] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const markRead = async (userId: string, at?: string) => {
    const supabase = createClient();
    await supabase.from("conversation_read").upsert(
      {
        conversation_id: id,
        member_id: userId,
        last_read_at: at ?? new Date().toISOString(),
      },
      { onConflict: "conversation_id,member_id" },
    );
    setReadTime(id, at);
  };

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    let msgChannel: ReturnType<typeof supabase.channel> | null = null;
    let readChannel: ReturnType<typeof supabase.channel> | null = null;

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
        .select(
          "conversation_id, member_id, buyer:member_id(name), item:item_id(title, member_id, seller:member_id(name))",
        )
        .eq("conversation_id", id)
        .single();
      const c = conv as unknown as {
        member_id: string;
        buyer?: { name: string };
        item?: { title: string; member_id: string; seller?: { name: string } };
      } | null;
      if (c) {
        setItemTitle(c.item?.title ?? "");
        const other = user.id === c.member_id ? c.item?.seller?.name : c.buyer?.name;
        setOtherName(other ?? "");
      }

      const { data: history } = await supabase
        .from("message")
        .select("*")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true })
        .limit(200);
      setMsgs(((history ?? []) as Msg[]));
      // เปิดห้อง = อ่านถึงปัจจุบัน (DB สำหรับ ✓✓ + local สำหรับ badge)
      await markRead(user.id);

      // เวลาอ่านล่าสุดของอีกฝั่ง
      const { data: reads } = await supabase
        .from("conversation_read")
        .select("member_id, last_read_at")
        .eq("conversation_id", id)
        .neq("member_id", user.id)
        .limit(1)
        .maybeSingle();
      if (reads) setOtherReadAt(Date.parse(reads.last_read_at));

      // Realtime ข้อความใหม่ (KPI ≤1s)
      msgChannel = supabase
        .channel(`room-${id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "message", filter: `conversation_id=eq.${id}` },
          (payload) => {
            const m = payload.new as Msg;
            setMsgs((prev) => (prev.some((p) => p.message_id === m.message_id) ? prev : [...prev, m]));
            if (m.sender_id !== user.id) void markRead(user.id, m.created_at);
          },
        )
        .subscribe((s) => {
          if (s === "SUBSCRIBED") setStatus("ok");
          else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") setStatus("reconnect");
        });

      // Realtime เวลาอ่านของอีกฝั่ง → ✓✓ ขึ้นทันที
      readChannel = supabase
        .channel(`read-${id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "conversation_read",
            filter: `conversation_id=eq.${id}`,
          },
          (payload) => {
            const row = payload.new as { member_id: string; last_read_at: string };
            if (row.member_id !== user.id) setOtherReadAt(Date.parse(row.last_read_at));
          },
        )
        .subscribe();
    };
    init();
    return () => {
      if (msgChannel) supabase.removeChannel(msgChannel);
      if (readChannel) supabase.removeChannel(readChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      message_type: "text",
    });
    if (!error) setText("");
    setSending(false);
  };

  const sendImage = async (file: File) => {
    if (!myId || uploading) return;
    setImgErr(null);
    if (!ACCEPTED_TYPES.includes(file.type) || file.size > MAX_FILE_MB * 1024 * 1024) {
      setImgErr("ขนาดไฟล์ต้องไม่เกิน 5MB และรองรับเฉพาะ JPG, PNG, WebP");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const path = `${myId}/${id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("chat-images")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("chat-images").getPublicUrl(path);
      const { error: insErr } = await supabase.from("message").insert({
        conversation_id: id,
        sender_id: myId,
        message_text: "📷 รูปภาพ",
        message_type: "image",
        image_url: pub.publicUrl,
      });
      if (insErr) throw insErr;
    } catch (e: unknown) {
      setImgErr(e instanceof Error ? e.message : "ส่งรูปไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ข้อความสุดท้ายที่ฉันส่ง — ไว้อ้างอิง ✓✓ อ่านแล้ว
  const myLast = [...msgs].reverse().find((m) => m.sender_id === myId);
  const seenByOther =
    myLast && otherReadAt !== null && otherReadAt >= Date.parse(myLast.created_at);

  return (
    <div className="mx-auto mt-6 flex h-[70vh] max-w-2xl flex-col rounded-3xl border bg-white">
      <div className="flex items-center gap-3 border-b p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 text-lg font-bold text-purple-700">
          {otherName ? otherName.slice(0, 1).toUpperCase() : "💬"}
        </span>
        <div className="min-w-0">
          <p className="truncate font-bold">{otherName || "ห้องแชท"}</p>
          <p className="truncate text-xs text-stone-500">{itemTitle}</p>
        </div>
        {status === "reconnect" && (
          <p className="ml-auto shrink-0 text-xs text-amber-600">กำลังเชื่อมต่อใหม่…</p>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {msgs.map((m) => {
          const mine = m.sender_id === myId;
          const isLastMine = myLast?.message_id === m.message_id;
          return (
            <div key={m.message_id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                {m.message_type === "image" && m.image_url ? (
                  <button type="button" onClick={() => setLightbox(m.image_url)} className="overflow-hidden rounded-2xl border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.image_url} alt="รูปในแชท" className="max-h-56 w-auto object-cover" />
                  </button>
                ) : (
                  <p
                    className={`rounded-2xl px-4 py-2 text-sm ${
                      mine ? "bg-purple-700 text-white" : "bg-stone-100 text-stone-800"
                    }`}
                  >
                    {m.message_text}
                  </p>
                )}
                <span className="mt-0.5 px-1 text-[11px] text-stone-400">
                  {clock(m.created_at)}
                  {mine && isLastMine && seenByOther && (
                    <span className="ml-1 font-semibold text-purple-500">✓✓ อ่านแล้ว</span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {imgErr && <p className="border-t px-4 pt-2 text-xs text-red-600">{imgErr}</p>}
      <div className="flex gap-2 border-t p-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void sendImage(f);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="ส่งรูปภาพ"
          className="shrink-0 rounded-full border px-3 py-2 text-sm hover:bg-stone-100 disabled:opacity-50"
        >
          {uploading ? "⏳" : "📷"}
        </button>
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

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="รูปขยาย" className="max-h-full max-w-full rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
}
