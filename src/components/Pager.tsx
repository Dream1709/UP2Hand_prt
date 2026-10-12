"use client";

export default function Pager({
  page,
  totalPages,
  onGo,
}: {
  page: number;
  totalPages: number;
  onGo: (p: number) => void;
}) {
  // มีหน้าเดียว → ซ่อน pager ไม่ให้รก
  if (totalPages <= 1) return null;

  // เลขหน้าแบบย่อ: โชว์หน้าปัจจุบัน ±2 + หน้าแรก/สุดท้าย
  const nums = new Set<number>([1, totalPages, page - 2, page - 1, page, page + 1, page + 2]);
  const sorted = [...nums].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);

  const btn = (label: string, target: number, disabled = false, active = false) => (
    <button
      key={label}
      disabled={disabled}
      onClick={() => onGo(target)}
      aria-label={label}
      className={`min-w-9 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
        active
          ? "bg-purple-700 text-white"
          : "border bg-white hover:bg-purple-50 disabled:opacity-40"
      }`}
    >
      {label}
    </button>
  );

  const nodes: React.ReactNode[] = [];
  let prev = 0;
  for (const n of sorted) {
    if (n - prev > 1) {
      nodes.push(
        <span key={`gap-${n}`} className="px-1 text-stone-400">
          …
        </span>,
      );
    }
    nodes.push(btn(String(n), n, false, n === page));
    prev = n;
  }

  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
      {btn("‹ ก่อนหน้า", page - 1, page <= 1)}
      {nodes}
      {btn("ถัดไป ›", page + 1, page >= totalPages)}
      <span className="w-full text-center text-xs text-stone-400">
        หน้า {page} จาก {totalPages}
      </span>
    </div>
  );
}
