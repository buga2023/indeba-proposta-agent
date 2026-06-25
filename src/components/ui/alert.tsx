import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  info: "bg-blue-50 border-l-primary",
  success: "bg-success/10 border-l-success",
  warning: "bg-orange-500/10 border-l-orange-600",
  danger: "bg-red-100 border-l-red-600",
};
const fg: Record<Tone, string> = {
  info: "text-primary",
  success: "text-success",
  warning: "text-orange-700",
  danger: "text-red-600",
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
  return (
    <div className={cn("flex gap-3 rounded-md border-l-[3px] p-4", tones[tone], className)}>
      <div>
        {title && <div className={cn("mb-0.5 text-sm font-bold", fg[tone])}>{title}</div>}
        {children && <div className="text-sm leading-normal text-foreground">{children}</div>}
      </div>
    </div>
  );
}
