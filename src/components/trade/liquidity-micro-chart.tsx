"use client";

import { useEffect, useRef } from "react";
import { AreaSeries, ColorType, createChart, type UTCTimestamp } from "lightweight-charts";

import { cn } from "@/lib/ui/cn";

type Props = { slug: string; className?: string };

/**
 * Client-only decorative strip. Shape is synthetic from slug hash — not a liquidity oracle.
 */
export function LiquidityMicroChart({ slug, className }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    let disposed = false;
    const chart = createChart(el, {
      width: el.clientWidth || 320,
      height: 112,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(148,163,184,0.85)",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: { vertLine: { visible: false }, horzLine: { visible: false } },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#a78bfa",
      topColor: "rgba(167,139,250,0.35)",
      bottomColor: "rgba(167,139,250,0.02)",
      lineWidth: 2,
    });

    let h = 2166136261;
    for (let i = 0; i < slug.length; i++) {
      h ^= slug.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }

    const now = Math.floor(Date.now() / 1000);
    const data: { time: UTCTimestamp; value: number }[] = [];
    let v = 0.4 + (h % 100) / 500;
    for (let t = 0; t < 48; t++) {
      v += Math.sin(t / 5 + (h % 7)) * 0.02 + (((h >> (t % 12)) & 3) - 1) * 0.01;
      v = Math.max(0.12, Math.min(1.2, v));
      data.push({ time: (now - (48 - t) * 3600) as UTCTimestamp, value: v });
    }
    series.setData(data);
    chart.timeScale().fitContent();

    return () => {
      disposed = true;
      void disposed;
      chart.remove();
    };
  }, [slug]);

  return <div ref={hostRef} className={cn("h-[112px] w-full", className)} aria-hidden />;
}
