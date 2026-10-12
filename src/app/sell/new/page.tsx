"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ACCEPTED_TYPES, MAX_FILE_MB, MAX_IMAGES, isSupabaseConfigured } from "@/lib/types";

interface PickedImage {
  file: File;
  preview: string;
}

export default function NewListing() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("0");
  const [desc, setDesc] = useState("");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<{ title?: string; price?: string }>({});
  const [saving, setSaving] = useState(false);

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const picked: PickedImage[] = [];
    for (const f of incoming) {
      if (!ACCEPTED_TYPES.includes(f.type) || f.size > MAX_FILE_MB * 1024 * 1024) {
        setErr("ขนาดไฟล์ต้องไม่เกิน 5MB และรองรับเฉพาะ JPG, PNG, WebP");
        return;
      }
      picked.push({ file: f, preview: URL.createObjectURL(f) });
    }
    setErr(null);
    setImages((prev) => {
      const merged = [...prev, ...picked].slice(0, MAX_IMAGES);
      // เกินโควต้า → คืน URL ส่วนเกินกัน memory leak
      for (const p of [...prev, ...picked].slice(MAX_IMAGES)) URL.revokeObjectURL(p.preview);
      return merged;
    });
  };

  const removeImage = (i: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, j) => j !== i);
    });
  };

  // คืน URL ทั้งหมดตอนออกจากหน้า (ซิงก์ ref ใน effect + revoke ตอน unmount)
  const imagesRef = useRef<PickedImage[]>([]);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  useEffect(() => {
    return () => {
      for (const p of imagesRef.current) URL.revokeObjectURL(p.preview);
    };
  }, []);

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
      for (const img of images) {
        const f = img.file;
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

      <p className="mt-6 text-sm font-semibold">
        📷 รูปภาพสินค้า ({images.length}/{MAX_IMAGES})
        <span className="ml-2 text-xs font-normal text-stone-400">
          JPG/PNG/WebP · ไม่เกิน {MAX_FILE_MB}MB/รูป
        </span>
      </p>

      {/* โซนแตะเพิ่มรูป — ใหญ่ชัดเจน + ลากวางได้ */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {images.length < MAX_IMAGES ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
          className={`mt-2 flex h-40 w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed transition ${
            dragOver
              ? "border-purple-600 bg-purple-50"
              : "border-purple-300 bg-purple-50/50 hover:border-purple-500 hover:bg-purple-50"
          }`}
        >
          <span className="text-4xl">📷</span>
          <span className="font-semibold text-purple-800">แตะเพื่อเพิ่มรูป</span>
          <span className="text-xs text-stone-500">หรือลากไฟล์มาวางที่นี่ (ยังขาดอีก {MAX_IMAGES - images.length} รูป)</span>
        </button>
      ) : (
        <p className="mt-2 rounded-2xl bg-green-50 px-4 py-3 text-center text-sm font-semibold text-green-700">
          ครบ {MAX_IMAGES} รูปแล้ว ✓ (ลบรูปออกก่อนถ้าอยากเปลี่ยน)
        </p>
      )}

      {/* พรีวิวรูปที่เลือก */}
      {images.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {images.map((img, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-xl border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.preview} alt={`รูปที่ ${i + 1}`} className="h-full w-full object-cover" />
              {i === 0 && (
                <span className="absolute left-1 top-1 rounded-full bg-purple-700 px-2 py-0.5 text-[11px] font-bold text-white">
                  ปก
                </span>
              )}
              <button
                type="button"
                aria-label={`ลบรูปที่ ${i + 1}`}
                onClick={() => removeImage(i)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs font-bold text-white hover:bg-red-600"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

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
