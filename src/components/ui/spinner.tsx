import * as React from "react";
import { cn } from "@/lib/utils";

export function Spinner({
  size = 24,
  color = "var(--primary)",
  className,
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-block rounded-full border-[var(--gray-200)]", className)}
      style={{
        width: size,
        height: size,
        borderWidth: Math.max(2, size / 10),
        borderStyle: "solid",
        borderTopColor: color,
        animation: "ind-spin 0.7s linear infinite",
      }}
    />
  );
}
