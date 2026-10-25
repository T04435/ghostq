import Link from "next/link";
import { CrowdDots } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { cn } from "cn";

/** The DS's Empty on shadcn Empty: the quiet crowd grid, a title, a line, and one primary action. `lg` for a page. */
export function EmptyState({ title, body, action, size = "md" }: { title: string; body?: string; action?: { label: string; href: string }; size?: "md" | "lg" }) {
  const lg = size === "lg";
  return (
    <Empty className={cn(lg && "gap-3 px-6 py-14")}>
      <EmptyHeader className={lg ? "gap-3" : undefined}>
        <EmptyMedia>
          <CrowdDots size={lg ? 56 : 40} gap={lg ? 6 : 4} />
        </EmptyMedia>
        <EmptyTitle className={lg ? "text-xl" : undefined}>{title}</EmptyTitle>
        {body && <EmptyDescription className={lg ? "text-sm" : undefined}>{body}</EmptyDescription>}
      </EmptyHeader>
      {action && (
        <EmptyContent>
          <Button asChild size="sm" className="mt-1 h-10 px-[18px] text-sm">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
