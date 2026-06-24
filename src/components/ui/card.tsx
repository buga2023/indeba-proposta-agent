import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Eleva no hover (translateY + sombra). Use em cards clicáveis. */
  interactive?: boolean;
  /** Padding interno em px (atalho do design). Sem isto, controle via className. */
  padding?: number;
}

export function Card({ className, interactive, padding, style, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        interactive &&
          "cursor-pointer transition-[transform,box-shadow] duration-200 hover:-translate-y-[3px] hover:shadow-md",
        className,
      )}
      style={padding != null ? { padding, ...style } : style}
      {...props}
    />
  );
}
