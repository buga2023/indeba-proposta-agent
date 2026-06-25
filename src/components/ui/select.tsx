import * as React from "react";
import { cn } from "@/lib/utils";

type Opt = string | { value: string; label: string };

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { options?: Opt[] }
>(({ className, options = [], children, ...props }, ref) => (
  <div className="relative w-full">
    <select
      ref={ref}
      className={cn(
        "h-[42px] w-full appearance-none rounded-md border border-input bg-card pl-3.5 pr-9 text-sm text-foreground outline-none transition focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/25",
        className,
      )}
      {...props}
    >
      {children ??
        options.map((o) => {
          const value = typeof o === "string" ? o : o.value;
          const label = typeof o === "string" ? o : o.label;
          return (
            <option key={value} value={value}>
              {label}
            </option>
          );
        })}
    </select>
    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">
      ▼
    </span>
  </div>
));
Select.displayName = "Select";
