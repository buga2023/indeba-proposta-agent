import * as React from "react";
import { cn } from "@/lib/utils";

export function Switch({
  checked = false,
  onChange,
  disabled = false,
  className,
}: {
  checked?: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
      className={cn(
        "relative inline-flex h-[26px] w-11 flex-none rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-[var(--border-strong)]",
        className,
      )}
    >
      <span
        className="absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-sm transition-[left] duration-200"
        style={{ left: checked ? 21 : 3, transitionTimingFunction: "var(--ease-spring)" }}
      />
    </button>
  );
}
