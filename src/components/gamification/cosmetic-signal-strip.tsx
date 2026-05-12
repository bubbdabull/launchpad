"use client";

import { Fire, Fish, Lightning } from "phosphor-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

/**
 * Cosmetic flair only — no financial meaning, not authoritative for rewards or tiers.
 */
export function CosmeticSignalStrip({
  className,
  earlySupporter,
  whale,
  streakDays,
}: {
  className?: string;
  earlySupporter?: boolean;
  whale?: boolean;
  streakDays?: number;
}) {
  const chips: Array<{ key: string; label: string; icon: ReactNode; show: boolean }> = [
    {
      key: "early",
      label: "Early",
      icon: <Lightning className="h-3.5 w-3.5" weight="fill" aria-hidden />,
      show: !!earlySupporter,
    },
    {
      key: "whale",
      label: "Whale tag",
      icon: <Fish className="h-3.5 w-3.5" weight="fill" aria-hidden />,
      show: !!whale,
    },
    {
      key: "streak",
      label: streakDays ? `${streakDays}d streak` : "Streak",
      icon: <Fire className="h-3.5 w-3.5" weight="fill" aria-hidden />,
      show: typeof streakDays === "number" && streakDays > 0,
    },
  ];

  const visible = chips.filter((c) => c.show);
  if (!visible.length) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)} aria-label="Cosmetic badges (non-authoritative)">
      {visible.map((c) => (
        <span
          key={c.key}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/85 ring-1 ring-white/[0.06]"
        >
          <span className="text-accent">{c.icon}</span>
          {c.label}
        </span>
      ))}
      <span className="text-[10px] text-muted">Vibes only</span>
    </div>
  );
}
