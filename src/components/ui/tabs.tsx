"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

type Tab = string | { value: string; label: React.ReactNode };

export function Tabs({
  tabs = [],
  value,
  onChange,
  className,
}: {
  tabs?: Tab[];
  value?: string;
  onChange?: (v: string) => void;
  className?: string;
}) {
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const [ind, setInd] = React.useState({ left: 0, width: 0 });
  const first = tabs[0];
  const active = value ?? (typeof first === "string" ? first : first?.value);

  React.useLayoutEffect(() => {
    const el = active ? refs.current[active] : null;
    if (el) setInd({ left: el.offsetLeft, width: el.offsetWidth });
  }, [active, tabs]);

  return (
    <div className={cn("relative border-b border-border", className)}>
      <div className="flex gap-1">
        {tabs.map((t) => {
          const val = typeof t === "string" ? t : t.value;
          const label = typeof t === "string" ? t : t.label;
          const on = val === active;
          return (
            <button
              key={val}
              ref={(el) => {
                refs.current[val] = el;
              }}
              onClick={() => onChange?.(val)}
              className={cn(
                "px-3.5 py-2.5 text-sm transition-colors",
                on ? "font-semibold text-primary" : "font-medium text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      <span
        className="absolute -bottom-px h-[2.5px] rounded-full bg-primary transition-[left,width] duration-200"
        style={{ left: ind.left, width: ind.width, transitionTimingFunction: "var(--ease-out)" }}
      />
    </div>
  );
}
