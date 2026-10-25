import type { Metadata } from "next";
import { NOINDEX } from "@/lib/site";

// Only useful with a ballot loaded in this browser, so kept out of search results.
export const metadata: Metadata = { title: "Choose what to research", robots: NOINDEX, alternates: {} };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
