import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "danger";

const base =
  "btn-label inline-flex items-center justify-center rounded-none px-6 py-3 transition-colors duration-300 ease-staudt disabled:cursor-not-allowed disabled:opacity-40";

const variants: Record<Variant, string> = {
  primary:
    "border border-navy bg-transparent text-navy hover:bg-navy hover:text-white",
  ghost:
    "border border-line bg-transparent text-body hover:border-navy hover:text-navy",
  danger:
    "border border-navy bg-navy text-white hover:bg-tier hover:border-tier",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  fullWidth?: boolean;
};

export function Button({
  variant = "primary",
  fullWidth,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

type LinkButtonProps = {
  href: string;
  variant?: Variant;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
};

export function LinkButton({
  href,
  variant = "primary",
  fullWidth,
  className = "",
  children,
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={`${base} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {children}
    </Link>
  );
}
