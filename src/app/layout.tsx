import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ResearchRunner } from "@/components/research-runner";
import { SupportFooterLink } from "@/components/support-card";
import { Nav } from "@/components/nav";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

const title = "Ballot Helper: Nonpartisan research on your sample ballot";
const description =
  "Upload your sample ballot and get nonpartisan research on every candidate, judge and ballot measure: qualifications, positions, endorsements, criticisms and red flags. Then compare, pick, and export a marked ballot. Free.";

export const metadata: Metadata = {
  // Absolute base for canonical URLs and the link-preview image (src/app/opengraph-image.tsx).
  metadataBase: new URL(SITE_URL),
  title: { default: title, template: "%s · Ballot Helper" },
  description,
  applicationName: "Ballot Helper",
  alternates: { canonical: "/" },
  openGraph: { title, description, url: "/", siteName: "Ballot Helper", type: "website", locale: "en_US" },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = { themeColor: "#08090a", colorScheme: "dark" };

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Ballot Helper",
  url: SITE_URL,
  description,
  applicationCategory: "ReferenceApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans text-[15px]">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur-md print:hidden">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 text-sm font-medium tracking-tight">
              <Logo />
              <span className="hidden sm:inline">Ballot Helper</span>
            </Link>
            <Nav />
          </div>
        </header>
        <ResearchRunner />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line py-6 text-center text-xs text-faint print:hidden">
          AI-generated summaries can be wrong. Check sources before you vote.
          <SupportFooterLink />
          <span className="mt-2 block">
            <Link href="/terms" className="hover:text-muted">
              Terms
            </Link>
            {" · "}
            <Link href="/privacy" className="hover:text-muted">
              Privacy
            </Link>
          </span>
        </footer>
      </body>
    </html>
  );
}
