import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "accent" | "success" | "outline" | "ghost";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm",
  accent: "bg-accent text-accent-foreground hover:bg-accent-hover shadow-sm",
  success: "bg-success text-success-foreground hover:brightness-95 shadow-sm",
  outline: "border border-gray-300 bg-card text-foreground hover:bg-muted",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-xs rounded-md",
  md: "h-[42px] px-[18px] text-sm rounded-lg",
  lg: "h-12 px-6 text-base rounded-lg",
  icon: "h-[42px] w-[42px] rounded-lg",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-[background,transform,box-shadow] duration-200 outline-none active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
