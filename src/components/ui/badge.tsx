import * as React from "react";
import { cn } from "@/lib/utils";

type Tom = "neutro" | "ia" | "manual" | "catalogo" | "success" | "warning" | "danger" | "info";

const tons: Record<Tom, string> = {
  neutro: "bg-muted text-muted-foreground",
  ia: "bg-primary/10 text-primary",
  manual: "bg-accent/15 text-accent",
  catalogo: "bg-[var(--success-soft)] text-success",
  success: "bg-[var(--success-soft)] text-success",
  warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
  info: "bg-[var(--info-soft)] text-[var(--info)]",
};

export function Badge({
  tom = "neutro",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tom?: Tom }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tons[tom],
        className,
      )}
      {...props}
    />
  );
}
