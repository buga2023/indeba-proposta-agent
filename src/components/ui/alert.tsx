import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "warning" | "danger";

const tones: Record<Tone, { wrap: string; bar: string; title: string }> = {
  info: { wrap: "bg-[var(--info-soft)]", bar: "border-l-primary", title: "text-[var(--info)]" },
  success: { wrap: "bg-[var(--success-soft)]", bar: "border-l-success", title: "text-success" },
  warning: { wrap: "bg-[var(--warning-soft)]", bar: "border-l-[var(--warning)]", title: "text-[var(--warning)]" },
  danger: { wrap: "bg-[var(--danger-soft)]", bar: "border-l-[var(--danger)]", title: "text-[var(--danger)]" },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const t = tones[tone];
  return (
    <div
      className={cn("flex gap-3 rounded-lg border-l-[3px] px-4 py-3.5", t.wrap, t.bar, className)}
      style={{ animation: "fadeUp var(--duration-base) var(--ease-out) both" }}
    >
      <div>
        {title && <div className={cn("text-sm font-bold", t.title, children ? "mb-0.5" : "")}>{title}</div>}
        {children && <div className="text-sm leading-normal text-foreground">{children}</div>}
      </div>
    </div>
  );
}
