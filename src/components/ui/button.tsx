import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-3 text-sm font-semibold transition disabled:opacity-60",
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = "Button";
