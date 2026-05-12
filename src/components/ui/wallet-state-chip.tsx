"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";

/**
 * Wallet UI must not read adapter state during SSR / first paint: auto-restore
 * can flip `publicKey` before hydration finishes and hard-break React (which
 * makes Privy / SIWS sign-in feel “dead”).
 */
export function WalletStateChip() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { publicKey, connecting } = useWallet();
  const short = publicKey ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}` : null;

  if (!mounted) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/50 backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
        Wallet…
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/80 backdrop-blur">
      <span className={`h-1.5 w-1.5 rounded-full ${connecting ? "animate-pulse bg-amber-400" : short ? "bg-emerald-400" : "bg-white/30"}`} />
      {connecting ? "Connecting…" : short ? short : "Wallet offline"}
    </div>
  );
}
