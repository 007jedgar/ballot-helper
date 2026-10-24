"use client";

import { useState } from "react";

export function Bullets({
  title,
  items,
  tone = "neutral",
  limit = 4,
}: {
  title: string;
  items: string[];
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
        {shown.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-[13px] leading-snug text-fg/90">
            <span className={`mt-[7px] h-1 w-1 shrink-0 rounded-full ${dot}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      {items.length > limit && (
        <button onClick={() => setOpen(!open)} className="mt-1.5 pl-3.5 text-[12px] text-muted hover:text-fg">
          {open ? "Show less" : `+${items.length - limit} more`}
        </button>
      )}
    </div>
  );
}
