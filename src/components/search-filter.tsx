"use client";

import { Search } from "lucide-react";
import { cn } from "cn";
import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** The DS's Search: shadcn Input as a 44 px pill with a search icon. */
export function SearchField({ className, ...props }: ComponentProps<typeof Input>) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input type="search" className="h-11 pl-10 text-sm" {...props} />
    </div>
  );
}

/**
 * The DS's Filter: a shadcn Select trigger as a pill reading "City" or, when set, "City · Miami", filled graphite.
 * The label stays for screen readers.
 */
export function FilterSelect({ id, label, value, all, onChange, options }: { id: string; label: string; value: string; all: string; onChange: (v: string) => void; options: [string, string][] }) {
  const on = value !== all;
  return (
    <div className="flex">
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className={cn("max-w-full gap-1.5", on && "border-foreground bg-foreground text-background hover:border-foreground")}>
          <SelectValue>{on ? `${label} · ${options.find(([v]) => v === value)?.[1] ?? value}` : label}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={all}>All</SelectItem>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
