import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "primary" | "accent" | "success";

const fills: Record<Tone, string> = {
  primary: "bg-primary",
  accent: "bg-accent",
  success: "bg-success",
};

export function ProgressBar({
  value = null,
  tone = "primary",
  className,
}: {
  /** 0–100 determinado; null = varredura indeterminada. */
  value?: number | null;
  tone?: Tone;
  className?: string;
}) {
  const indeterminate = value === null;
  return (
    <div className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("absolute inset-y-0 left-0 rounded-full", fills[tone])}
        style={
          indeterminate
            ? { width: "30%", animation: "indeterminate 1.2s var(--ease-standard) infinite" }
            : {
                width: `${Math.max(0, Math.min(100, value))}%`,
                transition: "width var(--duration-slow) var(--ease-out)",
              }
        }
      />
    </div>
  );
}
