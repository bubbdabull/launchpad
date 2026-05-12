"use client";

import Marquee from "react-fast-marquee";

import { cn } from "@/lib/ui/cn";

type Line = { id: string; label: string };

export function MarketParticipationMarquee({
  lines,
  className,
}: {
  lines: Line[];
  className?: string;
}) {
  if (!lines.length) return null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/10 bg-black/45 py-2.5 text-[11px] text-white/85 backdrop-blur-md",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-black to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-black to-transparent" />
      <Marquee gradient={false} speed={42} pauseOnHover>
        {lines.map((l) => (
          <span key={l.id} className="mx-6 inline-flex items-center gap-2 font-mono uppercase tracking-wider text-muted">
            <span className="h-1 w-1 rounded-full bg-accent shadow-[0_0_10px_rgba(34,245,158,0.8)]" />
            <span className="text-white/90">{l.label}</span>
          </span>
        ))}
      </Marquee>
    </div>
  );
}
