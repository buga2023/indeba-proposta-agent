import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-[transform,box-shadow] duration-200",
        interactive && "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg",
        className,
      )}
      {...props}
    />
  );
}
