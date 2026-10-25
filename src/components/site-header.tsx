"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "cn";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList } from "@/components/ui/navigation-menu";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const LINKS = [
  { href: "/write", label: "Write", match: (p: string) => p.startsWith("/write") },
  // A song's page and its remixes live in the Library.
  { href: "/library", label: "Library", match: (p: string) => p.startsWith("/library") || p.startsWith("/song") || p.startsWith("/remix") },
  { href: "/how", label: "How it works", match: (p: string) => p.startsWith("/how") },
];

const link = "rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-transparent hover:text-foreground focus:bg-transparent data-active:bg-muted data-active:font-semibold data-active:text-foreground data-active:hover:bg-muted data-active:focus:bg-muted";

/** The DS header: the lockup (home, the Landing) on the left, Write · Library · How it works on the right (a Sheet menu on a phone). */
export function SiteHeader() {
  return (
    <header className="border-b bg-background text-foreground">
      <div className="flex h-15 items-center justify-between gap-4 px-(--page-x)">
        <Link href="/" className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring">
          <Wordmark />
        </Link>
        {/* The path is request data: the nav streams in with the active link; until then it shows none active. */}
        <Suspense fallback={<HeaderNav path={null} />}>
          <ActiveHeaderNav />
        </Suspense>
      </div>
    </header>
  );
}

function ActiveHeaderNav() {
  return <HeaderNav path={usePathname()} />;
}

function HeaderNav({ path }: { path: string | null }) {
  const on = (l: (typeof LINKS)[number]) => (path ? l.match(path) : false);
  return (
    <>
      <NavigationMenu viewport={false} className="hidden sm:flex">
        <NavigationMenuList className="gap-1">
          {LINKS.map((l) => (
            <NavigationMenuItem key={l.href}>
              <NavigationMenuLink asChild active={on(l)} className={link}>
                <Link href={l.href}>{l.label}</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="text-foreground sm:hidden" aria-label="Menu">
            <Menu className="size-5" aria-hidden />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-64 gap-1 p-4 pt-14">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          {LINKS.map((l) => (
            <SheetClose key={l.href} asChild>
              <Link href={l.href} data-active={on(l) || undefined} className={cn(link, "block text-base")}>
                {l.label}
              </Link>
            </SheetClose>
          ))}
        </SheetContent>
      </Sheet>
    </>
  );
}
