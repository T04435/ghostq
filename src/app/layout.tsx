import type { Metadata } from "next";
import { Geist_Pixel, Hanken_Grotesk, Red_Hat_Mono } from "next/font/google";
import { PlayerProvider } from "@/components/qplayer/player-context";
import { QPlayer } from "@/components/qplayer/qplayer";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { versionText } from "@/lib/version";
import "./ghostq-theme.css";

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${hanken.variable} ${redHatMono.variable} ${geistPixel.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider>
          {/* One audio element for the site: a song keeps playing in the QPlayer from page to page. */}
          <PlayerProvider>
            <SiteHeader />
            <QPlayer />
            {/* Dark mode follows the system through CSS alone (ghostq-theme.css). Each page lays out its own frame. */}
            <main className="flex w-full flex-1 flex-col">{children}</main>
            <SiteFooter />
          </PlayerProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
