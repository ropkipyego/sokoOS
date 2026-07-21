import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn.js";
import styles from "./button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        styles.root,
        styles[variant] ?? "",
        styles[size] ?? "",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
