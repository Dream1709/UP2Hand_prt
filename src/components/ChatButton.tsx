"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getOrCreateConversation } from "@/lib/chat";

export default function ChatButton({
  itemId,
  sellerId,
}: {
  itemId: string;
  sellerId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const start = async () => {
    setLoading(true);
    setErr(null);
    try {
      const convId = await getOrCreateConversation(itemId, sellerId);
      router.push(`/chat/${convId}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "เปิดห้องแชทไม่สำเร็จ";
      if (msg.includes("เข้าสู่ระบบ")) {
        router.push("/login");
        return;
      }
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1">
      <button
        onClick={start}
        disabled={loading}
        className="w-full rounded-full bg-purple-700 py-3 font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
      >
        {loading ? "กำลังเปิดห้องแชท…" : "💬 ทักแชท"}
      </button>
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}
