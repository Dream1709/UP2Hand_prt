"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured, timeAgo, type Member } from "@/lib/types";

interface AdminItem {
  item_id: string;
  title: string;
  price: number;
  status: string;
  created_at: string;
  member?: { name: string; email: string };
}

export default function AdminPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(
    isSupabaseConfigured ? null : false,
  );
  const [tab, setTab] = useState<"items" | "users">("items");
  const [items, setItems] = useState<AdminItem[]>([]);
  const [users, setUsers] = useState<Member[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const init = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: me } = await supabase
        .from("member")
        .select("role")
        .eq("member_id", user.id)
        .single();
      if (me?.role !== "admin") {
        setAllowed(false);
        return;
      }
      setAllowed(true);
      const { data: it } = await supabase
        .from("item")
        .select("item_id,title,price,status,created_at,member:member_id(name,email)")
        .order("created_at", { ascending: false })
        .limit(100);
      setItems((it ?? []) as unknown as AdminItem[]);
      const { data: us } = await supabase
        .from("member")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setUsers(((us ?? []) as unknown as Member[]));
    };
    init();
  }, [router]);

  const refresh = async () => {
    const supabase = createClient();
    const { data: it } = await supabase
      .from("item")
      .select("item_id,title,price,status,created_at,member:member_id(name,email)")
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((it ?? []) as unknown as AdminItem[]);
    const { data: us } = await supabase
      .from("member")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setUsers(((us ?? []) as unknown as Member[]));
  };

  const suspendItem = async (id: string, to: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("item").update({ status: to }).eq("item_id", id);
    setMsg(error ? error.message : `อัปเดตโพสต์เป็น ${to} แล้ว`);
    refresh();
  };

  const deleteItem = async (id: string) => {
    if (!confirm("ลบโพสต์นี้ถาวร?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("item").delete().eq("item_id", id);
    setMsg(error ? error.message : "ลบโพสต์แล้ว");
    refresh();
  };

  const banUser = async (id: string, ban: boolean) => {
    if (ban && !confirm("ระงับบัญชีนี้? ผู้ใช้จะเข้าไม่ได้ทันที")) return;
    const supabase = createClient();
    const { error } = await supabase.from("member").update({ is_banned: ban }).eq("member_id", id);
    setMsg(error ? error.message : ban ? "ระงับบัญชีแล้ว" : "ปลดระงับแล้ว");
    refresh();
  };

  if (allowed === null) return <p className="pt-10 text-center text-stone-500">กำลังตรวจสอบสิทธิ์…</p>;
  if (!allowed)
    return (
      <div className="mx-auto mt-10 max-w-md rounded-3xl border bg-white p-8 text-center">
        <p className="text-5xl">🚫</p>
        <h1 className="mt-2 text-xl font-bold">403 Forbidden</h1>
        <p className="mt-1 text-sm text-stone-500">หน้านี้เฉพาะผู้ดูแลระบบ</p>
        <button onClick={() => router.push("/")} className="mt-4 rounded-full bg-purple-700 px-6 py-2 text-sm font-semibold text-white">
          กลับหน้าหลัก
        </button>
      </div>
    );

  return (
    <div className="pt-6">
      <h1 className="text-xl font-bold">Admin Dashboard 🛡️</h1>
      {msg && <p className="mt-2 rounded-xl bg-purple-50 px-4 py-2 text-sm text-purple-800">{msg}</p>}
      <div className="mt-4 flex gap-2">
        <button onClick={() => setTab("items")} className={`rounded-full px-5 py-2 text-sm font-semibold ${tab === "items" ? "bg-purple-700 text-white" : "border"}`}>
          โพสต์ ({items.length})
        </button>
        <button onClick={() => setTab("users")} className={`rounded-full px-5 py-2 text-sm font-semibold ${tab === "users" ? "bg-purple-700 text-white" : "border"}`}>
          ผู้ใช้ ({users.length})
        </button>
      </div>

      {tab === "items" ? (
        <div className="mt-4 overflow-x-auto rounded-2xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs text-stone-500">
              <tr><th className="p-3">สินค้า</th><th className="p-3">ผู้ขาย</th><th className="p-3">สถานะ</th><th className="p-3">จัดการ</th></tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.item_id} className="border-t">
                  <td className="p-3"><p className="font-semibold">{it.title}</p><p className="text-xs text-stone-400">{timeAgo(it.created_at)}</p></td>
                  <td className="p-3 text-xs">{it.member?.name}<br />{it.member?.email}</td>
                  <td className="p-3"><span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs">{it.status}</span></td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {it.status !== "suspended" ? (
                        <button onClick={() => suspendItem(it.item_id, "suspended")} className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">ระงับ</button>
                      ) : (
                        <button onClick={() => suspendItem(it.item_id, "available")} className="rounded-full bg-green-100 px-3 py-1 text-xs text-green-800">คืนสถานะ</button>
                      )}
                      <button onClick={() => deleteItem(it.item_id)} className="rounded-full bg-red-100 px-3 py-1 text-xs text-red-700">ลบ</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs text-stone-500">
              <tr><th className="p-3">ผู้ใช้</th><th className="p-3">role</th><th className="p-3">สถานะ</th><th className="p-3">จัดการ</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.member_id} className="border-t">
                  <td className="p-3"><p className="font-semibold">{u.name}</p><p className="text-xs text-stone-400">{u.email}</p></td>
                  <td className="p-3 text-xs">{u.role}</td>
                  <td className="p-3">{u.is_banned ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">โดนแบน</span> : <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">ปกติ</span>}</td>
                  <td className="p-3">
                    {!u.is_banned ? (
                      <button onClick={() => banUser(u.member_id, true)} className="rounded-full bg-red-600 px-3 py-1 text-xs text-white">Ban</button>
                    ) : (
                      <button onClick={() => banUser(u.member_id, false)} className="rounded-full bg-green-600 px-3 py-1 text-xs text-white">ปลดแบน</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
