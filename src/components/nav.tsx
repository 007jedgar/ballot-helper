"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProgress } from "@/lib/research";
import { useBallot, useHydrated } from "@/lib/store";

const links = [
  { href: "/", label: "Upload" },
  { href: "/research", label: "Research" },
  { href: "/compare", label: "Compare" },
  { href: "/review", label: "Export" },
];

export function Nav() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const hasBallot = useBallot((s) => !!s.ballot);
  const { done, total } = useProgress();
  if (!hydrated || !hasBallot) return null;

  return (
    <nav className="flex items-center gap-0.5 text-[13px] sm:gap-1">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`rounded-md px-2 py-1.5 transition-colors sm:px-2.5 ${
            pathname === l.href ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"
          }`}
        >
          {l.label}
          {l.href === "/research" && total > 0 && done < total && (
            <span className="ml-1.5 font-mono text-[11px] text-faint">
              {done}/{total}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
