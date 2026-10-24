import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover shadow-[0_0_0_1px_rgb(255_255_255/0.08)_inset]",
  secondary: "bg-surface-2 text-fg border border-line hover:border-line-strong",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
};

export function buttonClass(variant: Variant = "secondary", extra = "") {
  return `inline-flex items-center justify-center gap-2 rounded-lg px-3.5 h-9 text-[13px] font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none ${variants[variant]} ${extra}`;
}

export function Button({ variant = "secondary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...props} className={buttonClass(variant, className)} />;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "good" | "warn" | "bad" }) {
  const tones = {
    neutral: "text-muted border-line",
    accent: "text-[#a5adff] border-accent/40 bg-accent/10",
    good: "text-good border-good/30 bg-good/10",
    warn: "text-warn border-warn/30 bg-warn/10",
    bad: "text-bad border-bad/30 bg-bad/10",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-muted/40 border-t-fg ${className}`}
      aria-hidden
    />
  );
}

export function kindLabel(kind: "candidate" | "measure" | "retention") {
  return kind === "measure" ? "Measure" : kind === "retention" ? "Retention" : "Race";
}
