import * as React from "react";
import { cn } from "@/lib/utils";

type Tom = "neutro" | "ia" | "manual" | "catalogo";

const tons: Record<Tom, string> = {
  neutro: "bg-muted text-muted-foreground",
  ia: "bg-primary/10 text-primary",
  manual: "bg-accent/15 text-accent",
  catalogo: "bg-success/10 text-success",
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
