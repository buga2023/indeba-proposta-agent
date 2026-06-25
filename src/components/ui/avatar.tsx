import * as React from "react";
import { cn } from "@/lib/utils";

const sizes = { sm: 28, md: 38, lg: 52 } as const;

export function Avatar({
  name = "",
  src,
  size = "md",
  className,
}: {
  name?: string;
  src?: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const px = sizes[size];
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div
      className={cn("inline-flex flex-none items-center justify-center overflow-hidden rounded-full font-bold text-white shadow-sm", className)}
      style={{ width: px, height: px, fontSize: px * 0.4, background: src ? "var(--muted)" : "linear-gradient(135deg,#1e6bb8,#0e3a5f)" }}
    >
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : initials}
    </div>
  );
}
