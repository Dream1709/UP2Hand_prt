"use client";

export default function Stars({
  value,
  size = "md",
}: {
  value: number;
  size?: "sm" | "md" | "lg";
}) {
  const cls = size === "lg" ? "text-2xl" : size === "sm" ? "text-xs" : "text-base";
  return (
    <span className={`${cls} tracking-tight`} aria-label={`${value} ดาว`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={s <= Math.round(value) ? "text-amber-400" : "text-stone-300"}>
          ★
        </span>
      ))}
    </span>
  );
}
