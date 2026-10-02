"use client";

import Link from "next/link";
import { formatPrice, timeAgo, type Item } from "@/lib/types";

export default function FeedCard({ item }: { item: Item }) {
  const cover = item.images?.[0]?.image_url;
  return (
    <Link
      href={`/items/${item.item_id}`}
      className="group overflow-hidden rounded-2xl border bg-white transition hover:shadow-lg"
    >
      <div className="aspect-[4/3] bg-stone-100">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={item.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl">
            📦
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              item.price === 0
                ? "bg-green-100 text-green-700"
                : "bg-purple-100 text-purple-700"
            }`}
          >
            {formatPrice(item.price)}
          </span>
          {item.status === "sold" && (
            <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs text-stone-600">
              ขายแล้ว
            </span>
          )}
        </div>
        <h3 className="mt-2 line-clamp-1 font-semibold text-stone-900 group-hover:text-purple-800">
          {item.title}
        </h3>
        <p className="mt-1 line-clamp-1 text-sm text-stone-500">
          {item.description || "—"}
        </p>
        <p className="mt-2 text-xs text-stone-400">
          {item.member?.name ?? "ผู้ขาย"} · {timeAgo(item.created_at)}
        </p>
      </div>
    </Link>
  );
}
