import Link from "next/link";

import { WalletAuthButton } from "@/components/auth/WalletAuthButton";
import { AppNavBar } from "@/components/site/AppNavBar";
import { getWalletSession } from "@/lib/auth/session";

export async function Header() {
  const session = await getWalletSession();

  return (
    <header className="sticky top-0 z-[100] border-b border-white/[0.06] bg-black/90 backdrop-blur-xl supports-[backdrop-filter]:bg-black/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5 rounded-xl py-1 outline-none ring-accent/0 focus-visible:ring-2"
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent font-display text-sm font-bold tracking-tight text-ink shadow-[0_0_18px_rgba(34,245,158,0.25)]"
            aria-hidden
          >
            ↑
          </span>
          <span className="hidden min-[380px]:inline font-display text-lg font-semibold tracking-tight text-white">
            Launch<span className="text-accent">Pad</span>
          </span>
        </Link>

        <AppNavBar signedIn={!!session} />

        <div className="shrink-0 pl-1">
          <WalletAuthButton signedInAddress={session?.address ?? null} />
        </div>
      </div>
    </header>
  );
}
