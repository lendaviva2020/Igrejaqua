import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

const button = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-controle px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-cobre text-papel hover:bg-[#8f3c18]",
        secondary: "border border-tinta-2 bg-transparent text-tinta hover:bg-superficie",
        quiet: "bg-transparent text-nanquim hover:underline",
        danger: "bg-vinho text-papel hover:bg-[#6f2430]",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {}

export function Button({ className, variant, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(button({ variant }), className)} {...props} />;
}
