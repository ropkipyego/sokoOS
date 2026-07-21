import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn.js";
import styles from "./input.module.css";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
};

export function Input({ label, hint, error, className, id, ...rest }: InputProps) {
  const inputId = id ?? (typeof label === "string" ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <label className={styles.field} htmlFor={inputId}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <input
        id={inputId}
        className={cn(styles.input, error ? styles.invalid : null, className)}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {error ? <span className={styles.error}>{error}</span> : null}
      {!error && hint ? <span className={styles.hint}>{hint}</span> : null}
    </label>
  );
}
