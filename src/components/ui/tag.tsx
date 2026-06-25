"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Tag({
  active = false,
  removable = false,
  onRemove,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  active?: boolean;
  removable?: boolean;
  onRemove?: (e: React.MouseEvent) => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
        active ? "border-primary bg-primary text-white" : "border-gray-300 bg-card text-foreground hover:bg-muted",
        className,
      )}
      {...props}
    >
      {children}
      {removable && (
        <button onClick={(e) => { e.stopPropagation(); onRemove?.(e); }} className="ml-0.5 inline-flex opacity-70 hover:opacity-100" aria-label="remover">
          ×
        </button>
      )}
    </span>
  );
}
