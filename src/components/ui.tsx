"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "danger" | "win" | "lose" | "subtle";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-linear-to-b from-neon-soft to-neon text-ink-950 shadow-[0_0_22px_-6px_var(--color-neon)] hover:from-white hover:to-neon-soft disabled:from-ink-700 disabled:to-ink-700 disabled:text-ink-400 disabled:shadow-none",
  ghost:
    "border border-ink-600 bg-ink-800/50 text-ink-200 hover:border-neon hover:text-white disabled:opacity-40",
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
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold tracking-wide uppercase",
        // Phản hồi khi bấm: 120ms, nêu đích danh property, không dùng `transition: all`.
        "transition-[transform,background-color,border-color,color,box-shadow] duration-120 ease-out",
        "active:scale-[0.97] disabled:active:scale-100",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon",
        "disabled:cursor-not-allowed",
        VARIANTS[variant],
        active ? "ring-2 ring-neon ring-offset-2 ring-offset-ink-950" : "",
        full ? "w-full" : "",
        className,
      ].join(" ")}
    />
  );
}

/**
 * Khung tech vát góc với viền neon — dùng cho các khối trình diễn
 * (đăng nhập, scoreboard, thẻ Booster). Hai lớp lồng nhau để có viền
 * gradient mà clip-path không cắt mất.
 */
export function Panel({
  children,
  className = "",
  color,
  breathe = false,
}: {
  children: ReactNode;
  className?: string;
  /** Màu viền — mặc định là neon xanh của chương trình. */
  color?: string;
  breathe?: boolean;
}) {
  const edge = color ?? "var(--color-neon)";
  return (
    <div className={`relative ${className}`}>
      <div
        className={`clip-notch absolute inset-0 ${breathe ? "edge-breathe" : ""}`}
        style={{
          background: `linear-gradient(160deg, ${edge} 0%, transparent 38%, transparent 62%, ${edge} 100%)`,
        }}
      />
      <div className="clip-notch absolute inset-px bg-linear-to-b from-ink-900 to-ink-950" />
      <div className="relative">{children}</div>
    </div>
  );
}

export function Card({
  title,
  subtitle,
  right,
  children,
  className = "",
  stagger,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Thứ tự trong nhóm — trễ 45ms mỗi bậc khi cả nhóm cùng xuất hiện. */
  stagger?: number;
}) {
  return (
    <section
      style={stagger ? ({ "--stagger": stagger } as React.CSSProperties) : undefined}
      className={`enter glow-soft rounded-2xl border border-ink-700/80 bg-linear-to-b from-ink-900/90 to-ink-950/80 p-4 backdrop-blur sm:p-5 ${className}`}
    >
      {(title || right) && (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-ink-700/60 pb-2.5">
          <div className="min-w-0">
            {title && (
              <h2 className="flex items-center gap-2 text-sm font-bold tracking-[0.16em] text-ink-200 uppercase">
                <span className="inline-block h-3.5 w-0.5 shrink-0 bg-neon shadow-[0_0_8px_var(--color-neon)]" />
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-1 text-xs text-ink-400">{subtitle}</p>}
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
    info: "border-neon/50 bg-neon/10 text-neon",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wider whitespace-nowrap uppercase transition-colors duration-150 ease-out ${tones[tone]}`}
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
        className="rounded-lg tabular w-full border border-ink-600 bg-ink-950/90 px-4 py-3 text-2xl font-bold text-white outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-neon focus:shadow-[0_0_18px_-6px_var(--color-neon)] disabled:opacity-50"
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
        className="rounded-lg w-full border border-ink-600 bg-ink-950/90 px-3 py-2.5 text-base text-white outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-neon focus:shadow-[0_0_18px_-6px_var(--color-neon)] disabled:opacity-50"
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
    tone === "brand"
      ? "text-brand"
      : tone === "muted"
        ? "text-ink-200"
        : "text-white";
  return (
    <div className="rounded-lg border border-ink-700 bg-linear-to-b from-ink-800/70 to-ink-900/70 px-3 py-2.5">
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
