"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Switch({
  checked = false,
  onCheckedChange,
  disabled,
  className,
}: {
  checked?: boolean;
  onCheckedChange?: (v: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange?.(!checked)}
      className={cn(
        "relative h-[26px] w-11 flex-none rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-primary" : "bg-gray-300",
        className,
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-sm transition-[left] duration-200",
          checked ? "left-[21px]" : "left-[3px]",
        )}
        style={{ transitionTimingFunction: "var(--ease-spring)" }}
      />
    </button>
  );
}
