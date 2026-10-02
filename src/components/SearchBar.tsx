"use client";

export default function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">
        🔍
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ค้นหาชื่อสินค้า เช่น พัดลม ตู้เย็น หนังสือ…"
        className="w-full rounded-full border border-stone-200 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
      />
    </div>
  );
}
