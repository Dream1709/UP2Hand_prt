"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/types";

function NavSearch({ mobile = false }: { mobile?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const initial = pathname === "/" ? (params.get("q") ?? "") : "";
  const [value, setValue] = useState(initial);
  const [debounced, setDebounced] = useState(initial);

  // Debounce 300ms ตาม Acceptance Criteria 10.3
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), 300);
    return () => clearTimeout(t);
  }, [value]);

  // พิมพ์ค้างไว้แล้วหยุด → ดัน query ขึ้น URL (เฉพาะอยู่หน้าฟีด)
  useEffect(() => {
    if (pathname !== "/") return;
    const current = params.get("q") ?? "";
    if (debounced === current) return;
    const url = debounced ? `/?q=${encodeURIComponent(debounced)}` : "/";
    const nav = async () => {
      router.push(url);
    };
    void nav();
  }, [debounced, pathname, params, router]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    router.push(v ? `/?q=${encodeURIComponent(v)}` : "/");
  };

  return (
    <form
      onSubmit={submit}
      className={mobile ? "relative w-full" : "relative hidden w-full flex-1 px-6 md:block"}
    >
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">
        🔍
      </span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="ค้นหาชื่อสินค้า…"
        className="w-full rounded-full border border-stone-200 bg-stone-50 py-2 pl-11 pr-4 text-sm outline-none focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-100"
      />
    </form>
  );
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
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
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-700 font-bold text-amber-300">
            UP
          </span>
          <span className="text-lg font-bold text-purple-900">
            UP 2 Hand
          </span>
        </Link>
        <Suspense>
          <NavSearch key={pathname} />
        </Suspense>
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
      <div className="mx-auto max-w-6xl px-4 pb-2 md:hidden">
        <Suspense>
          <NavSearch key={`${pathname}-m`} mobile />
        </Suspense>
      </div>
    </header>
  );
}
