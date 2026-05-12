import Link from "next/link";

const primary = [
  { href: "/", label: "Home" },
  { href: "/#launches", label: "Launches" },
  { href: "/dashboard", label: "Portfolio" },
  { href: "/create", label: "Create" },
] as const;

const legal = [
  { href: "/#", label: "Terms" },
  { href: "/#", label: "Privacy" },
  { href: "/#", label: "FAQ" },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-line bg-panel/40">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-md">
          <p className="font-display text-sm font-semibold text-white">LaunchPad</p>
          <p className="mt-1 text-sm text-muted">
            Find a launch and mint, or create your own. Wallet required.
          </p>
        </div>
        <div className="flex flex-col gap-6 sm:flex-row sm:gap-12">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Explore</p>
            <div className="mt-3 flex flex-col gap-2 text-sm text-muted">
              {primary.map((l) => (
                <Link key={l.href + l.label} href={l.href} className="hover:text-white">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Legal</p>
            <div className="mt-3 flex flex-col gap-2 text-sm text-muted">
              {legal.map((l) => (
                <Link key={l.label} href={l.href} className="hover:text-white">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-line/60 py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} LaunchPad ·{" "}
        <a
          href="https://phronis.tech"
          target="_blank"
          rel="noreferrer"
          className="text-white/80 underline decoration-white/30 underline-offset-2 hover:text-white"
        >
          Phronis Inc
        </a>
      </div>
    </footer>
  );
}
