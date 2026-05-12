import { Flame } from "lucide-react";

import { cn } from "@/lib/ui/cn";

/** UI-only “hot” indicator from cached mint velocity — not lifecycle authority. */
export function HotLaunchChip({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  if (!active) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400/25 via-rose-500/25 to-accent/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-100 ring-1 ring-amber-300/40",
        className,
      )}
    >
      <Flame className="h-3 w-3 text-amber-300" aria-hidden />
      Hot
    </span>
  );
}
