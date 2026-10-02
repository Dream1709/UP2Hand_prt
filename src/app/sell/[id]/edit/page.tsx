"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function EditListing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("0");
  const [desc, setDesc] = useState("");
  const [status, setStatus] = useState("available");
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("item")
      .select("*")
      .eq("item_id", id)
      .single()
      .then(({ data }) => {
        if (data) {
          setTitle(data.title);
          setPrice(String(data.price));
          setDesc(data.description ?? "");
          setStatus(data.status);
        }
      });
  }, [id]);

  const save = async () => {
    if (!title.trim()) {
      setMsg("กรุณากรอกชื่อสินค้า");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("item")
      .update({ title: title.trim(), price: Number(price), description: desc, status })
      .eq("item_id", id);
    setSaving(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    router.push(`/items/${id}`);
  };

  const remove = async () => {
    if (!confirm("ลบประกาศนี้ถาวร?")) return;
    const supabase = createClient();
    await supabase.from("item").delete().eq("item_id", id);
    router.push("/");
  };

  return (
    <div className="mx-auto mt-6 max-w-xl rounded-3xl border bg-white p-6">
      <h1 className="text-xl font-bold">แก้ไขประกาศ</h1>
      {msg && <p className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{msg}</p>}
      <label className="mt-4 block text-sm font-semibold">ชื่อสินค้า *</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-xl border px-4 py-3 text-sm" />
      <label className="mt-4 block text-sm font-semibold">ราคา (0 = แจกฟรี)</label>
      <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min={0} className="mt-1 w-full rounded-xl border px-4 py-3 text-sm" />
      <label className="mt-4 block text-sm font-semibold">รายละเอียด</label>
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border px-4 py-3 text-sm" />
      <label className="mt-4 block text-sm font-semibold">สถานะ</label>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded-xl border px-4 py-3 text-sm">
        <option value="available">ว่าง (Available)</option>
        <option value="sold">ขายแล้ว (Sold)</option>
      </select>
      <button onClick={save} disabled={saving} className="mt-6 w-full rounded-full bg-purple-700 py-3 font-semibold text-white hover:bg-purple-800">
        {saving ? "กำลังบันทึก…" : "บันทึก"}
      </button>
      <button onClick={remove} className="mt-2 w-full rounded-full border border-red-300 py-3 text-sm text-red-600 hover:bg-red-50">
        ลบประกาศ
      </button>
    </div>
  );
}
