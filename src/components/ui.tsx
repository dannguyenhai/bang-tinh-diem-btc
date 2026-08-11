"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "danger" | "win" | "lose" | "subtle";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand text-ink-950 hover:bg-[#ffd75e] disabled:bg-ink-700 disabled:text-ink-400",
  ghost:
    "border border-ink-600 bg-ink-800/60 text-ink-200 hover:border-brand hover:text-white disabled:opacity-40",
  subtle: "bg-ink-700/70 text-ink-200 hover:bg-ink-600 disabled:opacity-40",
  danger:
    "border border-lose/50 bg-lose/10 text-lose hover:bg-lose/20 disabled:opacity-40",
  win: "bg-win/15 border border-win/50 text-win hover:bg-win/25",
  lose: "bg-lose/15 border border-lose/50 text-lose hover:bg-lose/25",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  active?: boolean;
  full?: boolean;
}

export function Button({
  variant = "primary",
  active = false,
  full = false,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold tracking-wide uppercase transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:cursor-not-allowed",
        VARIANTS[variant],
        active ? "ring-2 ring-brand ring-offset-2 ring-offset-ink-950" : "",
        full ? "w-full" : "",
        className,
      ].join(" ")}
    />
  );
}

export function Card({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-ink-700 bg-ink-900/80 p-4 shadow-lg shadow-black/30 backdrop-blur ${className}`}
    >
      {(title || right) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && (
              <h2 className="text-sm font-bold tracking-[0.14em] text-ink-200 uppercase">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-1 text-xs text-ink-400">{subtitle}</p>
            )}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "win" | "lose" | "info";
}) {
  const tones = {
    neutral: "border-ink-600 bg-ink-800 text-ink-200",
    brand: "border-brand/50 bg-brand/10 text-brand",
    win: "border-win/50 bg-win/10 text-win",
    lose: "border-lose/50 bg-lose/10 text-lose",
    info: "border-info/50 bg-info/10 text-info",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function NumberField({
  label,
  hint,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: ReactNode }) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="mb-1.5 block text-[11px] font-bold tracking-[0.14em] text-ink-400 uppercase">
          {label}
        </span>
      )}
      <input
        {...props}
        inputMode="numeric"
        className="tabular w-full rounded-xl border border-ink-600 bg-ink-950/80 px-4 py-3 text-2xl font-bold text-white outline-none focus:border-brand disabled:opacity-50"
      />
      {hint && <span className="mt-1.5 block text-xs text-ink-400">{hint}</span>}
    </label>
  );
}

export function TextField({
  label,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="mb-1.5 block text-[11px] font-bold tracking-[0.14em] text-ink-400 uppercase">
          {label}
        </span>
      )}
      <input
        {...props}
        className="w-full rounded-xl border border-ink-600 bg-ink-950/80 px-3 py-2.5 text-base text-white outline-none focus:border-brand disabled:opacity-50"
      />
    </label>
  );
}

export function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "brand" | "muted";
}) {
  const valueTone =
    tone === "brand" ? "text-brand" : tone === "muted" ? "text-ink-200" : "text-white";
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-800/50 px-3 py-2.5">
      <div className="text-[10px] font-bold tracking-[0.14em] text-ink-400 uppercase">
        {label}
      </div>
      <div className={`tabular mt-0.5 text-2xl font-black ${valueTone}`}>
        {value}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-ink-700 px-4 py-6 text-center text-sm text-ink-400">
      {children}
    </p>
  );
}
