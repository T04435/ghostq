"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "cn";
import type { ReactNode } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/**
 * The DS's Collapsible on shadcn Collapsible: a card row with the chevron in a muted circle, the title, and a mono
 * meta on the right ("8 steps · 43 s"). `bare` drops the card for a section heading.
 */
export function SectionCollapsible({ title, meta, defaultOpen, bare = false, children }: { title: ReactNode; meta?: ReactNode; defaultOpen?: boolean; bare?: boolean; children: ReactNode }) {
  return (
    <Collapsible defaultOpen={defaultOpen} className={cn(!bare && "rounded-lg border bg-card")}>
      <CollapsibleTrigger
        className={cn(
          "group/section flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring",
          !bare && "px-4 py-3.5",
        )}
      >
        <span className={cn("inline-flex min-w-0 items-center gap-2.5 font-semibold tracking-[-0.01em]", bare ? "text-lg" : "text-base")}>
          <span aria-hidden className="inline-flex size-7 flex-none items-center justify-center rounded-full bg-muted transition-transform group-aria-expanded/section:rotate-90">
            <ChevronRight className="size-4" strokeWidth={2.5} />
          </span>
          {title}
        </span>
        {meta && <span className="font-mono text-[11px] whitespace-nowrap text-muted-foreground">{meta}</span>}
      </CollapsibleTrigger>
      <CollapsibleContent className={cn(!bare && "px-4 pb-4")}>{children}</CollapsibleContent>
    </Collapsible>
  );
}
