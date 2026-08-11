"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useGameStore } from "@/lib/store";
import type { SyncStatus } from "@/lib/types";

const STATUS_META: Record<SyncStatus, { label: string; dot: string }> = {
  offline: { label: "Ngoại tuyến", dot: "bg-ink-400" },
  connecting: { label: "Đang kết nối", dot: "bg-info animate-pulse" },
  online: { label: "Đã đồng bộ", dot: "bg-win" },
  saving: { label: "Đang lưu", dot: "bg-brand animate-pulse" },
  error: { label: "Lỗi kết nối", dot: "bg-lose" },
};

export function SyncPill() {
  const status = useGameStore((s) => s.status);
  const meta = STATUS_META[status];
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink-700 bg-ink-900 px-2.5 py-1 text-[10px] font-bold tracking-wider text-ink-200 uppercase">
      <span
        className={`h-1.5 w-1.5 rounded-full transition-colors duration-200 ease-out ${meta.dot}`}
      />
      <span className="hidden sm:inline">{meta.label}</span>
    </span>
  );
}

export function ErrorBanner() {
  const error = useGameStore((s) => s.error);
  const clearError = useGameStore((s) => s.clearError);
  if (!error) return null;
  return (
    <div
      role="alert"
      className="enter-banner fixed inset-x-3 bottom-3 z-50 mx-auto max-w-lg rounded-xl border border-lose/60 bg-[#2a1013] px-4 py-3 shadow-xl"
    >
      <div className="flex items-start gap-3">
        <p className="flex-1 text-sm text-lose">{error}</p>
        <button
          onClick={clearError}
          className="text-xs font-bold text-ink-200 uppercase transition-colors duration-150 hover:text-white"
        >
          Đóng
        </button>
      </div>
    </div>
  );
}

export function AppShell({
  title,
  subtitle,
  accent,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: ReactNode;
  accent?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const session = useGameStore((s) => s.session);
  const logout = useGameStore((s) => s.logout);
  const router = useRouter();
  const width = wide ? "max-w-7xl" : "max-w-2xl";

  return (
    <div className="min-h-dvh pb-24">
      <header className="sticky top-0 z-40 bg-ink-950/88 backdrop-blur">
        <div
          className={`mx-auto flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8 ${width}`}
        >
          <span
            className="h-9 w-1 shrink-0"
            style={{
              background: accent ?? "var(--color-neon)",
              boxShadow: `0 0 12px ${accent ?? "var(--color-neon)"}`,
            }}
          />
          <div className="min-w-0 flex-1">
            <h1
              className="truncate text-base font-black tracking-wide sm:text-lg"
              style={accent ? { color: accent } : undefined}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="truncate text-[10px] font-bold tracking-[0.2em] text-ink-400 uppercase">
                {subtitle}
              </p>
            )}
          </div>
          <SyncPill />
          {session && (
            <button
              onClick={async () => {
                await logout();
                router.push("/");
              }}
              className="shrink-0 rounded-lg border border-ink-700 px-2.5 py-1.5 text-[10px] font-bold text-ink-200 uppercase transition-colors duration-150 ease-out hover:border-lose hover:text-lose"
            >
              Thoát
            </button>
          )}
        </div>
        {/* Đường neon mảnh chạy hết bề ngang, thay cho border xám */}
        <div className="h-px bg-linear-to-r from-transparent via-neon/45 to-transparent" />
      </header>

      <main
        className={`mx-auto space-y-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 ${width}`}
      >
        {children}
      </main>

      <ErrorBanner />
    </div>
  );
}

export function LoadingScreen({ message = "Đang tải dữ liệu ván chơi…" }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-ink-700 border-t-brand" />
        <p className="text-sm text-ink-400">{message}</p>
      </div>
    </div>
  );
}

export function GuardMessage({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-lg font-black text-white">{title}</h1>
      {children}
      <Link
        href="/"
        className="rounded-xl bg-brand px-5 py-3 text-sm font-bold text-ink-950 uppercase transition-transform duration-120 ease-out active:scale-[0.97]"
      >
        Về màn đăng nhập
      </Link>
    </div>
  );
}
