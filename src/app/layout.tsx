import type { Metadata } from "next";
import { Geist_Pixel, Hanken_Grotesk, Red_Hat_Mono } from "next/font/google";
import Script from "next/script";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { versionText } from "@/lib/version";
import "./globals.css";

// The DS type: Hanken Grotesk 400/500/600 for UI, Red Hat Mono 400/500 for chords and data, Geist Pixel (its ELSH axis
// gives the Circle, Square and Grid cuts) for standalone readouts.
const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"], weight: ["400", "500", "600"] });
const redHatMono = Red_Hat_Mono({ variable: "--font-red-hat-mono", subsets: ["latin"], weight: ["400", "500"] });
const geistPixel = Geist_Pixel({ variable: "--font-geist-pixel", subsets: ["latin"], axes: ["ELSH"], adjustFontFallback: false });

export const metadata: Metadata = {
  title: "GhostQ",
  description: "An AI ghostwriter that knows your next crowd: original song sheets built on Qloo taste data, with a receipt on every line.",
  other: { "app-version": versionText() },
};

// Dark mode follows the system: .dark on <html> while prefers-color-scheme is dark, set before the first paint.
const followSystemTheme = `(()=>{const m=matchMedia("(prefers-color-scheme: dark)");const s=()=>document.documentElement.classList.toggle("dark",m.matches);s();m.addEventListener("change",s)})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${hanken.variable} ${redHatMono.variable} ${geistPixel.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Script id="follow-system-theme" strategy="beforeInteractive">
          {followSystemTheme}
        </Script>
        <TooltipProvider>
          <SiteHeader />
          <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">{children}</main>
          <SiteFooter />
        </TooltipProvider>
      </body>
    </html>
  );
}
