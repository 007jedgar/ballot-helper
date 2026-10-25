import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { buttonClass } from "@/components/ui";

export const metadata: Metadata = {
  title: "Thank you",
  // A post-payment landing page; keep it out of search results.
  robots: { index: false },
  alternates: {},
};

/** Where Stripe Payment Links redirect after a contribution. */
export default function ThanksPage() {
  return (
    <div className="glow">
      <section className="mx-auto max-w-md px-4 py-28 text-center sm:px-6">
        <Logo className="mx-auto h-12 w-12" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Thank you for chipping in</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          Your support helps keep Ballot Helper free, nonpartisan, and ad-free. Stripe will email you a receipt.
        </p>
        <div className="mt-8 flex justify-center gap-2">
          <Link href="/review" className={buttonClass("primary")}>
            Back to my ballot
          </Link>
          <Link href="/" className={buttonClass("secondary")}>
            Home
          </Link>
        </div>
      </section>
    </div>
  );
}
