export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`cm-shimmer rounded-lg bg-white/[0.06] ${className}`} />;
}
