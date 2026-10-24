import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { ResearchRunner } from "@/components/research-runner";
import { Nav } from "@/components/nav";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ballot Helper",
  description: "Upload your sample ballot, get nonpartisan research on every race and measure, and export your picks.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans text-[15px]">
        <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur-md print:hidden">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 text-sm font-medium tracking-tight">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-accent text-[11px] font-semibold">✓</span>
              <span className="hidden sm:inline">Ballot Helper</span>
            </Link>
            <Nav />
          </div>
        </header>
        <ResearchRunner />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line py-6 text-center text-xs text-faint print:hidden">
          AI-generated summaries can be wrong. Check sources before you vote.
        </footer>
      </body>
    </html>
  );
}
