import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-pine text-paper shadow-[0_16px_34px_rgba(38,59,104,0.24)] hover:bg-pine-dark active:translate-y-[1px]",
  secondary:
    "border border-hairline bg-white text-ink shadow-[0_8px_20px_rgba(28,42,74,0.05)] hover:border-pine/30 hover:bg-pine-soft active:translate-y-[1px]",
  ghost: "bg-transparent text-ink hover:bg-pine-soft active:translate-y-[1px]",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", className = "", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
