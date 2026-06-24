import * as React from "react";
import { cn } from "@/lib/utils";

const sizes = { sm: "h-7 w-7 text-[11px]", md: "h-9 w-9 text-xs", lg: "h-11 w-11 text-sm" };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      aria-label={name}
      title={name}
      className={cn(
        "inline-grid place-items-center rounded-full bg-primary font-semibold text-primary-foreground",
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
