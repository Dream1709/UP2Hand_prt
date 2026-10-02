"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/types";

function LoginInner() {
  const params = useSearchParams();
  const err = params.get("error");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(
    err === "banned"
      ? "บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ"
      : err === "domain"
        ? "อนุญาตเฉพาะบุคลากรและนิสิต ม.พะเยา (@up.ac.th) เท่านั้น"
        : null,
  );

  const login = async () => {
    if (!isSupabaseConfigured) {
      setMsg("ยังไม่ตั้งค่า Supabase — ดูวิธีที่ supabase/README.md แล้วเพิ่ม .env.local");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    // ใช้ origin ของเว็บที่เปิดอยู่จริง — กันพังตอน deploy (localhost vs production)
    const site = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${site}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) setMsg(error.message);
    setLoading(false);
  };

  return (
    <div className="mx-auto mt-10 max-w-md rounded-3xl border bg-white p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-700 font-bold text-amber-300">
        UP
      </div>
      <h1 className="mt-4 text-xl font-bold">เข้าสู่ระบบ UP 2 Hand</h1>
      <p className="mt-1 text-sm text-stone-500">
        ใช้ Gmail มหาวิทยาลัยพะเยา (@up.ac.th) เท่านั้น
      </p>
      {msg && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{msg}</p>
      )}
      <button
        onClick={login}
        disabled={loading}
        className="mt-6 w-full rounded-full bg-purple-700 py-3 font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
      >
        {loading ? "กำลังไปหน้า Google…" : "เข้าสู่ระบบด้วย UP Mail"}
      </button>
      <p className="mt-4 text-xs text-stone-400">
        Guest ดูสินค้าได้โดยไม่ต้อง login · ลงขาย/แชท/รีวิว ต้องยืนยันตัวตนก่อน
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
