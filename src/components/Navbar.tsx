"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/types";

export default function Navbar() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      setEmail(data.user?.email ?? null);
      if (data.user) {
        const { data: m } = await supabase
          .from("member")
          .select("role")
          .eq("member_id", data.user.id)
          .single();
        setIsAdmin(m?.role === "admin");
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-purple-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-700 font-bold text-amber-300">
            UP
          </span>
          <span className="text-lg font-bold text-purple-900">
            UP 2 Hand
            <span className="ml-2 hidden text-xs font-normal text-stone-500 sm:inline">
              ตลาดมือสอง ม.พะเยา
            </span>
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-2">
          {email && (
            <Link
              href="/chat"
              className="rounded-full px-4 py-2 text-sm hover:bg-stone-100"
            >
              💬 แชท
            </Link>
          )}
          <Link
            href="/sell/new"
            className="rounded-full bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800"
          >
            + ลงขาย
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800"
            >
              🛡️ Admin
            </Link>
          )}
          {email ? (
            <>
              <span className="hidden max-w-44 truncate text-sm text-stone-600 md:inline">
                {email}
              </span>
              <button
                onClick={logout}
                className="rounded-full border px-4 py-2 text-sm hover:bg-stone-100"
              >
                ออกจากระบบ
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-purple-700 px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-50"
            >
              เข้าสู่ระบบ
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
