import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

const button = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-ambar text-sobre-ambar hover:bg-ambar-claro",
        secondary: "border border-borda bg-transparent text-texto hover:bg-superficie-2",
        quiet: "bg-transparent px-2 text-ambar-claro hover:underline",
        danger: "bg-perigo text-fundo hover:brightness-110",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {}

export function Button({ className, variant, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(button({ variant }), className)} {...props} />;
}

/** Mesmas classes para <Link>/<a> com aparência de botão. */
export function buttonClasses(variant: ButtonProps["variant"] = "primary", className?: string): string {
  return cn(button({ variant }), className);
}
