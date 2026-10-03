"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { MOCK_ITEMS } from "@/lib/mock";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/types";

interface Suggestion {
  item_id: string;
  title: string;
}

const SUGGEST_LIMIT = 6;

function NavSearch({ mobile = false }: { mobile?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const initial = pathname === "/" || pathname === "/search" ? (params.get("q") ?? "") : "";
  const [value, setValue] = useState(initial);
  const [debounced, setDebounced] = useState(initial);
  const [suggests, setSuggests] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Debounce 300ms แล้วดึงชื่อที่ตรงมาโชว์ (ไม่เปลี่ยนหน้า)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), 300);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    if (!debounced) return;
    let cancelled = false;
    const run = async () => {
      setSearching(true);
      setOpen(true);
      if (!isSupabaseConfigured) {
        const local = MOCK_ITEMS.filter((i) =>
          i.title.toLowerCase().includes(debounced.toLowerCase()),
        )
          .slice(0, SUGGEST_LIMIT)
          .map((i) => ({ item_id: i.item_id, title: i.title }));
        if (!cancelled) {
          setSuggests(local);
          setSearching(false);
        }
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from("item")
        .select("item_id,title")
        .eq("status", "available")
        .ilike("title", `%${debounced}%`)
        .order("created_at", { ascending: false })
        .limit(SUGGEST_LIMIT);
      if (cancelled) return;
      setSuggests(((data ?? []) as unknown as Suggestion[]));
      setSearching(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  // คลิกข้างนอก → ปิด dropdown
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const goSearch = () => {
    const v = value.trim();
    setOpen(false);
    router.push(v ? `/search?q=${encodeURIComponent(v)}` : "/");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // ถ้าไฮไลต์แถวอยู่ → ไปสินค้านั้น, ไม่งั้นค้นหาทั้งหมด
    if (open && highlight >= 0 && visibleSuggests[highlight]) {
      pick(visibleSuggests[highlight]);
      return;
    }
    goSearch();
  };

  const pick = (s: Suggestion) => {
    setOpen(false);
    router.push(`/items/${s.item_id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || visibleSuggests.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % visibleSuggests.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + visibleSuggests.length) % visibleSuggests.length);
    }
  };

  // ทำตัวหนาตรงคำที่ตรงกับที่พิมพ์
  const boldMatch = (title: string) => {
    const i = title.toLowerCase().indexOf(debounced.toLowerCase());
    if (!debounced || i < 0) return title;
    return (
      <>
        {title.slice(0, i)}
        <b className="text-purple-800">{title.slice(i, i + debounced.length)}</b>
        {title.slice(i + debounced.length)}
      </>
    );
  };

  const showPanel = open && debounced.length > 0;
  const visibleSuggests = debounced ? suggests : [];

  return (
    <div
      ref={wrapRef}
      className={mobile ? "relative w-full" : "relative hidden w-full flex-1 px-6 md:block"}
    >
      <form
        onSubmit={submit}
        className="flex w-full items-center gap-2 rounded-full border border-stone-200 bg-stone-50 py-1 pl-4 pr-1 outline-none transition focus-within:border-purple-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-purple-100"
      >
        <span className="shrink-0 text-stone-400">🔍</span>
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setHighlight(-1);
          }}
          onFocus={() => debounced && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="ค้นหาชื่อสินค้า…"
          className="w-full bg-transparent py-1.5 text-sm outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-purple-700 px-5 py-1.5 text-sm font-semibold text-white hover:bg-purple-800"
        >
          ค้นหา
        </button>
      </form>

      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border bg-white shadow-xl">
          {searching ? (
            <p className="px-4 py-3 text-sm text-stone-400">กำลังค้นหา…</p>
          ) : visibleSuggests.length === 0 ? (
            <p className="px-4 py-3 text-sm text-stone-500">
              ไม่พบสินค้าที่ตรง ลองกดค้นหาเพื่อดูรายการใกล้เคียง
            </p>
          ) : (
            <ul>
              {visibleSuggests.map((s, i) => (
                <li key={s.item_id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(s)}
                    onMouseEnter={() => setHighlight(i)}
                    className={`block w-full truncate px-4 py-2.5 text-left text-sm hover:bg-purple-50 ${
                      highlight === i ? "bg-purple-50" : ""
                    }`}
                  >
                    {boldMatch(s.title)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
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
