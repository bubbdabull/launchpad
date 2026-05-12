"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";

import {
  IconGrid,
  IconHome,
  IconLayout,
  IconMenu,
  IconRocket,
  IconShare,
  IconUser,
  IconX,
} from "@/components/site/nav-icons";

type NavDef = {
  href: string;
  label: string;
  description: string;
  Icon: typeof IconHome;
  /** If true, only this path (no children) counts as active. */
  exact?: boolean;
  /** Hash for `/#section` links — client only. */
  hash?: string;
};

const PRIMARY: NavDef[] = [
  {
    href: "/",
    label: "Home",
    description: "Featured launches",
    Icon: IconHome,
    exact: true,
  },
  {
    href: "/#launches",
    label: "Launches",
    description: "Browse all",
    Icon: IconGrid,
    hash: "#launches",
  },
  { href: "/create", label: "Create", description: "New collection", Icon: IconRocket, exact: true },
  { href: "/dashboard", label: "Portfolio", description: "Your projects", Icon: IconLayout },
  { href: "/referrals", label: "Referrals", description: "Share link", Icon: IconShare },
];

const ACCOUNT: NavDef = {
  href: "/account",
  label: "Account",
  description: "Wallet and profile",
  Icon: IconUser,
  exact: true,
};

function normalizePath(pathname: string) {
  if (!pathname) return "/";
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

function linkActive(item: NavDef, pathname: string, hash: string): boolean {
  const p = normalizePath(pathname);
  if (item.hash) {
    return p === "/" && hash === item.hash;
  }
  if (item.exact) return p === item.href;
  if (item.href === "/") return p === "/";
  return p === item.href || p.startsWith(`${item.href}/`);
}

export function AppNavBar({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname() ?? "/";
  const [hash, setHash] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    setHash(typeof window !== "undefined" ? window.location.hash : "");
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const items = signedIn ? [...PRIMARY, ACCOUNT] : PRIMARY;

  const NavLink = ({
    item,
    className,
    onClick,
  }: {
    item: NavDef;
    className?: string;
    onClick?: () => void;
  }) => {
    const active = linkActive(item, pathname, hash);
    const base =
      "group inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition outline-none ring-accent/0 focus-visible:ring-2";
    const state = active
      ? "bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-accent/25"
      : "text-muted hover:bg-white/[0.05] hover:text-white";

    return (
      <Link
        href={item.href}
        className={`${base} ${state} ${className ?? ""}`}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
      >
        <item.Icon
          className={`h-[18px] w-[18px] shrink-0 ${active ? "text-accent" : "text-muted group-hover:text-accent/90"}`}
        />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      <nav
        className="ml-2 hidden min-w-0 flex-1 flex-wrap items-center justify-center gap-0.5 sm:ml-6 lg:flex"
        aria-label="Main"
      >
        {items.map((item) => (
          <NavLink key={item.href + (item.hash ?? "")} item={item} />
        ))}
      </nav>

      <div className="flex flex-1 justify-end lg:hidden">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white transition hover:bg-white/[0.07] hover:border-white/15"
          aria-expanded={mobileOpen}
          aria-controls={panelId}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen((o) => !o)}
        >
          {mobileOpen ? <IconX className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
            aria-label="Close menu"
            onClick={closeMobile}
          />
          <div
            id={panelId}
            className="fixed left-0 right-0 top-[3.5rem] z-50 max-h-[min(70vh,calc(100dvh-4rem))] overflow-y-auto border-b border-white/[0.08] bg-ink/95 px-4 py-4 shadow-2xl lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            <div className="mx-auto flex max-w-lg flex-col gap-1">
              {items.map((item) => {
                const active = linkActive(item, pathname, hash);
                return (
                  <Link
                    key={item.href + (item.hash ?? "") + "-m"}
                    href={item.href}
                    onClick={closeMobile}
                    className={`flex items-start gap-3 rounded-xl px-3 py-3 transition ${
                      active
                        ? "bg-white/[0.1] ring-1 ring-white/10"
                        : "hover:bg-white/[0.05]"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    <item.Icon className={`mt-0.5 h-5 w-5 shrink-0 ${active ? "text-accent" : "text-muted"}`} />
                    <span>
                      <span className="block font-medium text-white">{item.label}</span>
                      <span className="mt-0.5 block text-xs text-muted">{item.description}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
