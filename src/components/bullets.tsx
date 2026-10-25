"use client";

import { useState } from "react";

/** A bullet with an optional small label, shown dimmed when `muted` (e.g. an opponent's claim). */
export type BulletItem = { text: string; tag?: string; muted?: boolean };

export function Bullets({
  title,
  items,
  tone = "neutral",
  limit = 4,
}: {
  title: string;
  items: (string | BulletItem)[];
  tone?: "neutral" | "good" | "bad";
  limit?: number;
}) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  const shown = open ? items : items.slice(0, limit);
  const dot = tone === "good" ? "bg-good" : tone === "bad" ? "bg-bad" : "bg-faint";
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-faint">{title}</p>
      <ul className="space-y-1.5">
        {shown.map((raw, i) => {
          const item = typeof raw === "string" ? { text: raw } : raw;
          return (
            <li key={i} className={`flex gap-2.5 text-[13px] leading-snug ${item.muted ? "text-muted" : "text-fg/90"}`}>
              <span className={`mt-[7px] h-1 w-1 shrink-0 rounded-full ${item.muted ? "bg-faint" : dot}`} />
              <span>
                {item.tag && (
                  <span className="mr-1.5 whitespace-nowrap rounded border border-line px-1 py-px text-[10px] font-medium uppercase tracking-[0.04em] text-faint">
                    {item.tag}
                  </span>
                )}
                {item.text}
              </span>
            </li>
          );
        })}
      </ul>
      {items.length > limit && (
        <button onClick={() => setOpen(!open)} className="mt-1.5 pl-3.5 text-[12px] text-muted hover:text-fg">
          {open ? "Show less" : `+${items.length - limit} more`}
        </button>
      )}
    </div>
  );
}
