import * as React from "react";
import { cn } from "@/lib/utils";

export function Checkbox({
  checked = false,
  onChange,
  label,
  disabled = false,
  className,
}: {
  checked?: boolean;
  onChange?: (next: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-2.5 text-sm text-foreground select-none",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span
        onClick={() => !disabled && onChange?.(!checked)}
        className={cn(
          "inline-flex h-5 w-5 flex-none items-center justify-center rounded-[var(--radius-xs)] border transition-all duration-150",
          checked ? "border-primary bg-primary" : "border-[var(--border-strong)] bg-card",
        )}
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      {label}
    </label>
  );
}
