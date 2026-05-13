import { clsx } from "clsx";

type Props = { className?: string };

/** Short reminder: chain vs site — keep wording plain (see docs for engineers). */
export function ProtocolLayersHint({ className }: Props) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[12px] leading-snug text-muted",
        className,
      )}
    >
      <p>
        <span className="font-medium text-white/90">Solana</span> is where the real money rules live.{" "}
        <span className="font-medium text-white/90">This site</span> helps you sign in and sign transactions—what you
        see here follows the chain, it doesn&apos;t replace it.
      </p>
    </div>
  );
}
