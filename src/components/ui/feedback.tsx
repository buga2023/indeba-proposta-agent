import * as React from "react";
import { cn } from "@/lib/utils";

export function Spinner({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-block rounded-full border-gray-200 border-t-primary", className)}
      style={{ width: size, height: size, borderWidth: Math.max(2, size / 10), animation: "ind-spin .7s linear infinite" }}
    />
  );
}

export function ProgressBar({ value, tone = "primary" }: { value?: number; tone?: "primary" | "accent" | "success" }) {
  const fill = tone === "accent" ? "bg-accent" : tone === "success" ? "bg-success" : "bg-primary";
  const ind = value == null;
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-300", fill)}
        style={ind ? { width: "30%", animation: "ind-shimmer 1.2s ease-in-out infinite" } : { width: `${Math.min(100, Math.max(0, value!))}%` }}
      />
    </div>
  );
}
