import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutro" | "azul" | "laranja" | "sucesso";

const tones: Record<Tone, string> = {
  neutro: "bg-muted text-muted-foreground",
  azul: "bg-primary/10 text-primary",
  laranja: "bg-accent/15 text-accent",
  sucesso: "bg-[var(--success-soft)] text-success",
};

export function Tag({
  tone = "neutro",
  dot,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
