import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GhostQ",
  description: "An AI ghostwriter that knows your next crowd: original song sheets built on Qloo taste data, with a receipt on every line.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider>
          <header className="border-b">
            <nav className="mx-auto flex max-w-4xl items-center gap-6 px-4 py-3 text-sm">
              <Link href="/" className="font-semibold">
                GhostQ
              </Link>
              <Link href="/" className="text-muted-foreground hover:text-foreground">
                Write
              </Link>
              <Link href="/library" className="text-muted-foreground hover:text-foreground">
                Library
              </Link>
              <Link href="/how" className="text-muted-foreground hover:text-foreground">
                How it works
              </Link>
            </nav>
          </header>
          <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">{children}</main>
          <footer className="border-t">
            <p className="mx-auto max-w-4xl px-4 py-4 text-xs text-muted-foreground">Taste data from Qloo. Place names © <a href="https://www.openstreetmap.org/copyright" className="underline">OpenStreetMap contributors</a>. Songs are original; GhostQ never names or imitates a real artist.</p>
          </footer>
        </TooltipProvider>
      </body>
    </html>
  );
}
