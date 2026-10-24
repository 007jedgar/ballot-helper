import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover shadow-[0_0_0_1px_rgb(255_255_255/0.08)_inset]",
  secondary: "bg-surface-2 text-fg border border-line hover:border-line-strong",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
};

export function buttonClass(variant: Variant = "secondary", extra = "") {
  return `inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 h-9 text-[13px] font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none ${variants[variant]} ${extra}`;
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

export function FlagIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={`h-3.5 w-3.5 ${className}`}>
      <path d="M3 1.75a.75.75 0 0 1 1.5 0V2h7.69a.75.75 0 0 1 .6 1.2L10.94 5.5l1.85 2.3a.75.75 0 0 1-.6 1.2H4.5v5.25a.75.75 0 0 1-1.5 0V1.75Z" />
    </svg>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-[13px] text-muted hover:text-fg"
    >
      <span className={`relative h-[18px] w-8 rounded-full transition-colors ${checked ? "bg-bad/80" : "bg-surface-2 ring-1 ring-line-strong"}`}>
        <span
          className={`absolute left-0 top-[3px] h-3 w-3 rounded-full bg-white transition-transform ${checked ? "translate-x-[17px]" : "translate-x-[3px]"}`}
        />
      </span>
      {label}
    </button>
  );
}
