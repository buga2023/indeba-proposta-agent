import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full resize-y rounded-md border border-input bg-card px-3.5 py-2.5 text-sm leading-normal text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/25",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
