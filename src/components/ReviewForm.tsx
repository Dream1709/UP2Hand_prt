"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ReviewForm({
  revieweeId,
  onDone,
}: {
  revieweeId: string;
  onDone: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (rating === 0) {
      setErr("กรุณาเลือกคะแนนดาวก่อนส่งรีวิว");
      return;
    }
    setSaving(true);
    setErr(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErr("กรุณาเข้าสู่ระบบก่อนรีวิว");
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("review").insert({
      rating,
      comment: comment.trim(),
      reviewer_id: user.id,
      reviewee_id: revieweeId,
    });
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setRating(0);
    setComment("");
    onDone();
  };

  return (
    <div className="rounded-2xl border bg-white p-4">
      <p className="font-semibold">ให้คะแนนผู้ใช้คนนี้</p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            onClick={() => setRating(s)}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            className={`text-3xl ${(hover || rating) >= s ? "text-amber-400" : "text-stone-300"}`}
            aria-label={`${s} ดาว`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="เล่าประสบการณ์ซื้อขายสั้นๆ…"
        className="mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-purple-500"
      />
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
      <button
        onClick={submit}
        disabled={saving}
        className="mt-2 rounded-full bg-purple-700 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
      >
        {saving ? "กำลังส่ง…" : "ส่งรีวิว"}
      </button>
    </div>
  );
}
