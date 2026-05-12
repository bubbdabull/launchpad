"use client";

import type { ReactNode } from "react";

type Tier = "genesis" | "pulse" | "standard";

const rings: Record<Tier, string> = {
  genesis: "from-amber-200/80 via-fuchsia-500/50 to-cyan-300/70",
  pulse: "from-accent via-emerald-300/50 to-violet-500/60",
  standard: "from-white/30 via-white/10 to-white/25",
};

export function RarityFrame({ children, tier = "standard" }: { children: ReactNode; tier?: Tier }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br p-[1px] shadow-[0_0_40px_rgba(200,255,0,0.08)] ${rings[tier]}`}>
      <div className="rounded-[15px] bg-ink/95">{children}</div>
    </div>
  );
}
