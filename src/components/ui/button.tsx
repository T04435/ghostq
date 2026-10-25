import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// GhostQ DS button: always a pill, 600 weight. Sizes lg 52 · default (md) 44 · sm 36 · xs 30. Primary is lime with dark
// text in both themes; secondary is graphite. Hover dims to .88; disabled to .45.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding font-semibold leading-none whitespace-nowrap transition-all outline-none select-none focus-visible:ring-3 focus-visible:ring-ring active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-88",
        outline: "border-border bg-card text-foreground hover:border-foreground aria-expanded:border-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:opacity-88 aria-expanded:opacity-88",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-88 focus-visible:ring-destructive/40",
        link: "h-auto! rounded-sm px-0! font-semibold text-foreground underline underline-offset-3 hover:opacity-88",
      },
      size: {
        default: "h-11 gap-2 px-5 text-[15px] [&_svg:not([class*='size-'])]:size-4",
        xs: "h-[30px] gap-1.5 px-3 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-2 px-3.5 text-[13px]",
        lg: "h-[52px] gap-2 px-[26px] text-base [&_svg:not([class*='size-'])]:size-4",
        icon: "size-10 [&_svg:not([class*='size-'])]:size-4",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-[30px]",
        "icon-lg": "size-11 [&_svg:not([class*='size-'])]:size-[18px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
