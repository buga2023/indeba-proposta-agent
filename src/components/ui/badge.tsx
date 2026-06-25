import * as React from "react";
import { cn } from "@/lib/utils";

type Tom = "neutro" | "ia" | "manual" | "catalogo" | "success" | "warning" | "danger" | "info";

const tons: Record<Tom, string> = {
  neutro: "bg-muted text-muted-foreground",
  ia: "bg-primary/10 text-primary",
  manual: "bg-accent/15 text-accent-hover",
  catalogo: "bg-success/10 text-success",
  success: "bg-success/10 text-success",
  warning: "bg-orange-500/15 text-orange-700",
  danger: "bg-red-100 text-red-600",
  info: "bg-blue-50 text-primary",
};

export function Badge({
  tom = "neutro",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tom?: Tom }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        tons[tom],
        className,
      )}
      {...props}
    />
  );
}
