"use client";

import type { BreakdownLine } from "@/lib/types";

export function Breakdown({ lines }: { lines: BreakdownLine[] }) {
  return (
    <dl className="tabular space-y-1 text-sm">
      {lines.map((line, index) =>
        line.total ? (
          <div
            key={index}
            className="mt-2 flex items-baseline justify-between border-t border-ink-600 pt-2"
          >
            <dt className="text-[11px] font-bold tracking-[0.14em] text-ink-200 uppercase">
              {line.label}
            </dt>
            <dd className="text-2xl font-black text-brand">{line.value}</dd>
          </div>
        ) : (
          <div key={index} className="flex items-baseline justify-between">
            <dt className="text-ink-400">{line.label}</dt>
            <dd
              className={
                index === 0
                  ? "font-bold text-white"
                  : line.value >= 0
                    ? "font-bold text-win"
                    : "font-bold text-lose"
              }
            >
              {index === 0 || line.value < 0 ? line.value : `+${line.value}`}
            </dd>
          </div>
        ),
      )}
    </dl>
  );
}
