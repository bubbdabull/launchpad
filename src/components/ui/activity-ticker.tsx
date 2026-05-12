"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

export type TickerItem = { id: string; text: string };

type Props = { items: TickerItem[]; className?: string };

export function ActivityTicker({ items, className = "" }: Props) {
  const [i, setI] = useState(0);
  const list = useMemo(() => (items.length ? items : [{ id: "idle", text: "Feed warming…" }]), [items]);

  useEffect(() => {
    if (list.length <= 1) return;
    const t = window.setInterval(() => setI((v) => (v + 1) % list.length), 3200);
    return () => window.clearInterval(t);
  }, [list.length]);

  const current = list[i] ?? list[0];

  return (
    <div
      className={`relative overflow-hidden rounded-full border border-white/10 bg-black/50 px-4 py-2 text-xs text-white/80 backdrop-blur-md ${className}`}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
          transition={{ duration: 0.28 }}
          className="flex items-center gap-2"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_12px_rgba(200,255,0,0.6)]" />
          <span className="truncate font-medium tracking-tight text-white/90">{current.text}</span>
          <span className="ml-auto shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted">Live</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
