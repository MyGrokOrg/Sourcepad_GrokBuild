import { cn } from "@/lib/cn";
import { Check } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function IconButton({
  label,
  pressed,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-muted transition-colors duration-150",
        "hover:bg-elevated hover:text-fg disabled:pointer-events-none disabled:opacity-40",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        pressed && "bg-elevated text-primary",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function MenuItem({
  label,
  shortcut,
  checked,
  disabled,
  onClick,
}: {
  label: string;
  shortcut?: string;
  checked?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-fg hover:bg-surface disabled:opacity-40"
    >
      <span className="inline-flex w-4 justify-center text-primary">
        {checked ? <Check className="size-3.5" /> : null}
      </span>
      <span className="flex-1">{label}</span>
      {shortcut ? <span className="text-xs text-faint">{shortcut}</span> : null}
    </button>
  );
}

export function MenuPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="menu"
      className={cn(
        "absolute left-0 top-full z-40 mt-1 min-w-56 border border-border bg-elevated py-1 shadow-lg",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FieldButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border text-muted",
        "hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        pressed && "border-primary bg-editor text-primary",
      )}
    >
      {children}
    </button>
  );
}
