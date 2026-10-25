import type { ReactNode } from "react";

export const LEGAL_UPDATED = "October 25, 2026";
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || null;

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <p className="text-[13px] text-muted">Last updated {LEGAL_UPDATED}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-8 space-y-6 text-[14px] leading-relaxed text-fg/85 [&_a]:text-fg [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-10 [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:text-fg [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </article>
  );
}

export function Contact() {
  return CONTACT_EMAIL ? (
    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
  ) : (
    <>the contact address listed on this site</>
  );
}
