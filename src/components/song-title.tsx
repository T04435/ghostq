import { cn } from "cn";
import Link from "next/link";
import type { ElementType } from "react";

const SIZES = {
  sm: ["text-[15px]", "text-[13px]"],
  md: ["text-[17px]", "text-[13px]"],
  lg: ["text-[clamp(28px,4vw,40px)] leading-[1.05]", "text-[17px]"],
  xl: ["text-[clamp(30px,4vw,44px)] leading-[1.02]", "text-[17px]"],
} as const;

/**
 * ONE way to name a song (the user, 26 Oct: every title and artist displayed the same): the title, then the artist
 * smaller and muted on the same line, both in Geist Pixel Circle. `href` makes the title a link; `truncate` keeps it to
 * one line (the QPlayer, the full-screen sing-along).
 */
export function SongTitle({
  title,
  artist,
  size = "md",
  href,
  truncate = false,
  as: Tag = "span",
  className,
}: {
  title: string;
  artist?: string | null;
  size?: keyof typeof SIZES;
  href?: string;
  truncate?: boolean;
  as?: ElementType;
  className?: string;
}) {
  const [t, a] = SIZES[size];
  const name = cn("pixel-circle leading-tight", t, truncate ? "truncate" : "wrap-anywhere", href && "hover:underline");
  return (
    <Tag className={cn("flex min-w-0 items-baseline gap-x-2 gap-y-1 font-normal", truncate ? "flex-nowrap" : "flex-wrap", className)}>
      {href ? (
        <Link href={href} className={name}>
          {title}
        </Link>
      ) : (
        <span className={name}>{title}</span>
      )}
      {artist && <span className={cn("pixel-circle leading-tight text-muted-foreground", a, truncate ? "flex-none" : "wrap-anywhere")}>{artist}</span>}
    </Tag>
  );
}
