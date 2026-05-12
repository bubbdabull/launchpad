"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/ui/cn";

function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Illustrative tape only — not OHLCV, not execution, not authoritative PnL. */
export function TradeMomentumChart({ slug, className }: { slug: string; className?: string }) {
  const gradId = useMemo(() => `tm-${slug.replace(/[^a-zA-Z0-9_-]/g, "") || "x"}`, [slug]);
  const data = useMemo(() => {
    const seed = hashSeed(slug);
    const pts = 36;
    const out: { i: number; v: number }[] = [];
    let v = 40 + (seed % 30);
    for (let i = 0; i < pts; i++) {
      const wave = Math.sin(i / 4 + seed / 999) * 6;
      const noise = ((seed >> (i % 16)) & 7) - 3;
      v = Math.max(8, Math.min(96, v + wave * 0.35 + noise * 0.4));
      out.push({ i, v });
    }
    return out;
  }, [slug]);

  return (
    <div className={cn("h-[200px] w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(34,245,158,0.35)" />
              <stop offset="100%" stopColor="rgba(34,245,158,0)" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="i" hide />
          <YAxis hide domain={[0, 100]} />
          <Tooltip
            contentStyle={{
              background: "rgba(12,12,14,0.92)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              fontSize: 11,
            }}
            labelFormatter={() => "Illustrative momentum"}
            formatter={(value) => {
              const n = typeof value === "number" ? value : Number(value);
              if (Number.isNaN(n)) return ["—", "Display"];
              return [`${n.toFixed(1)} · vibe index`, "Display"];
            }}
          />
          <Area type="monotone" dataKey="v" stroke="#22f59e" fill={`url(#${gradId})`} strokeWidth={2} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
