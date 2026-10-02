"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ACCEPTED_TYPES, MAX_FILE_MB, MAX_IMAGES, isSupabaseConfigured } from "@/lib/types";

export default function NewListing() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("0");
  const [desc, setDesc] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<{ title?: string; price?: string }>({});
  const [saving, setSaving] = useState(false);

  const onFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = [...files, ...Array.from(list)].slice(0, MAX_IMAGES);
    for (const f of arr) {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        setErr("ขนาดไฟล์ต้องไม่เกิน 5MB และรองรับเฉพาะ JPG, PNG, WebP");
        return;
      }
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        setErr("ขนาดไฟล์ต้องไม่เกิน 5MB และรองรับเฉพาะ JPG, PNG, WebP");
        return;
      }
    }
    setErr(null);
    setFiles(arr);
  };

  const submit = async () => {
    const fe: { title?: string; price?: string } = {};
    if (!title.trim()) fe.title = "กรุณากรอกชื่อสินค้า";
    if (price === "" || Number.isNaN(Number(price)) || Number(price) < 0)
      fe.price = "กรุณากรอกราคาให้ถูกต้อง (ใส่ 0 = แจกฟรี)";
    setFieldErr(fe);
    if (Object.keys(fe).length > 0) return;

    if (!isSupabaseConfigured) {
      setErr("ยังไม่ตั้งค่า Supabase — ดู supabase/README.md แล้วเพิ่ม .env.local ก่อนลงขายจริง");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const supabase = createClient();
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        router.push("/login");
        return;
      }
      const { data: item, error } = await supabase
        .from("item")
        .insert({
          title: title.trim(),
          price: Number(price),
          description: desc.trim(),
          member_id: u.user.id,
          status: "available",
        })
        .select("item_id")
        .single();
      if (error) throw error;

      // อัปโหลดรูป 1–5 รูป
      for (const f of files) {
        const path = `${u.user.id}/${item.item_id}/${Date.now()}-${f.name}`;
        const { error: upErr } = await supabase.storage
          .from("item-images")
          .upload(path, f, { contentType: f.type });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("item-images").getPublicUrl(path);
        await supabase.from("item_image").insert({
          item_id: item.item_id,
          image_url: pub.publicUrl,
        });
      }
      router.push(`/items/${item.item_id}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "โพสต์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto mt-6 max-w-xl rounded-3xl border bg-white p-6 sm:p-8">
      <h1 className="text-xl font-bold">ลงขายสินค้า — เสร็จใน 1 นาที ⚡</h1>
      <p className="mt-1 text-sm text-stone-500">แค่ 3 ช่อง: ชื่อ ราคา รายละเอียด + รูป 1–5 รูป</p>

      {err && <p className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{err}</p>}

      <label className="mt-6 block text-sm font-semibold">ชื่อสินค้า *</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="เช่น พัดลมตั้งโต๊ะ 16 นิ้ว"
        className="mt-1 w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-purple-500"
      />
      {fieldErr.title && <p className="mt-1 text-xs text-red-600">{fieldErr.title}</p>}

      <label className="mt-4 block text-sm font-semibold">ราคา (บาท) * — ใส่ 0 = แจกฟรี</label>
      <input
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        type="number"
        min={0}
        className="mt-1 w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-purple-500"
      />
      {fieldErr.price && <p className="mt-1 text-xs text-red-600">{fieldErr.price}</p>}

      <label className="mt-4 block text-sm font-semibold">รายละเอียดเพิ่มเติม</label>
      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        rows={4}
        placeholder="สภาพ ตำหนิ นัดรับที่ไหน…"
        className="mt-1 w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-purple-500"
      />

      <label className="mt-4 block text-sm font-semibold">รูปภาพ (1–5 รูป · JPG/PNG/WebP ≤5MB)</label>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(e) => onFiles(e.target.files)}
        className="mt-1 w-full text-sm"
      />
      {files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span key={i} className="rounded-full bg-purple-50 px-3 py-1 text-xs text-purple-800">
              {f.name}
              <button
                className="ml-2 text-red-500"
                onClick={() => setFiles(files.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <button
        onClick={submit}
        disabled={saving}
        className="mt-6 w-full rounded-full bg-purple-700 py-3 font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
      >
        {saving ? "กำลังโพสต์…" : "โพสต์ขายเลย"}
      </button>
    </div>
  );
}
