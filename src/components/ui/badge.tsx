import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// GhostQ DS badges: pills. Data badges are mono 10 px (LIS · 25–34, SUNG, SHEET, REMIX); status badges 11 px 600
// (1 problem, Failed). Only Qloo data gets the signal colour.
const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-[3px] text-[11px] leading-none font-semibold whitespace-nowrap transition-all focus-visible:ring-[3px] focus-visible:ring-ring has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:opacity-88",
        secondary: "bg-muted text-foreground [a]:hover:opacity-88",
        destructive: "bg-destructive text-destructive-foreground",
        warning: "bg-warning text-warning-foreground",
        signal: "bg-signal font-mono text-[10px] font-normal text-signal-foreground",
        outline: "border-border font-mono text-[10px] font-normal text-muted-foreground [a]:hover:border-foreground",
        strong: "border-foreground font-mono text-[10px] font-normal text-foreground",
        mono: "bg-muted font-mono text-[10px] font-normal text-foreground",
        ghost: "hover:bg-muted hover:text-muted-foreground",
        link: "text-foreground underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
