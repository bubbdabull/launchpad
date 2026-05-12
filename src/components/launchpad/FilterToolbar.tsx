"use client";

import type { MintStatus } from "@/types/collection";

export type SortKey =
  | "trending"
  | "apr"
  | "fresh"
  | "filling"
  | "volume"
  | "price_asc"
  | "price_desc"
  | "supply_remaining"
  | "recent";

type Props = {
  status: "all" | MintStatus;
  onStatus: (s: "all" | MintStatus) => void;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  q: string;
  onQ: (s: string) => void;
  verified: boolean;
  onVerified: (v: boolean) => void;
  category: string | null;
  onCategory: (c: string | null) => void;
};

const CATEGORIES: Array<{ key: string; label: string }> = [
  { key: "memes", label: "Memes" },
  { key: "art", label: "Art" },
  { key: "gaming", label: "Gaming" },
  { key: "music", label: "Music" },
  { key: "ai", label: "AI" },
];

export function FilterToolbar({
  status,
  onStatus,
  sort,
  onSort,
  q,
  onQ,
  verified,
  onVerified,
  category,
  onCategory,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <input
            type="search"
            value={q}
            onChange={(e) => onQ(e.target.value)}
            placeholder="Search by name or ticker"
            className="w-full rounded-full border border-line bg-ink px-4 py-2.5 text-sm text-white placeholder:text-muted/60 outline-none ring-accent/30 focus:ring-2"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onVerified(!verified)}
            className={`rounded-full px-3 py-1.5 text-sm transition ${
              verified
                ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/40"
                : "border border-line bg-panel text-muted hover:text-white"
            }`}
            aria-pressed={verified}
          >
            Verified only
          </button>
          <label className="flex items-center gap-2 text-sm text-muted">
            <span className="text-xs uppercase tracking-wider">Sort</span>
            <select
              value={sort}
              onChange={(e) => onSort(e.target.value as SortKey)}
              className="rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
            >
              <optgroup label="Activity">
                <option value="apr">Highest 7d APR</option>
                <option value="filling">Filling fast</option>
                <option value="volume">24h volume</option>
              </optgroup>
              <optgroup label="Time">
                <option value="fresh">Newest</option>
              </optgroup>
              <optgroup label="Curated">
                <option value="trending">Trending</option>
                <option value="supply_remaining">Supply remaining</option>
                <option value="recent">Recently launched</option>
              </optgroup>
              <optgroup label="Mint price">
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
              </optgroup>
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <span className="mr-2 self-center text-xs font-medium uppercase tracking-wider text-muted">Status</span>
          {(
            [
              ["all", "All"],
              ["live", "Live"],
              ["upcoming", "Upcoming"],
              ["sold_out", "Sold out"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => onStatus(key)}
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                status === key ? "bg-white text-ink" : "border border-line bg-panel text-muted hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">Category</span>
        <button
          type="button"
          onClick={() => onCategory(null)}
          className={`rounded-full px-3 py-1.5 text-sm transition ${
            category == null ? "bg-white text-ink" : "border border-line bg-panel text-muted hover:text-white"
          }`}
        >
          All
        </button>
        {CATEGORIES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onCategory(category === key ? null : key)}
            className={`rounded-full px-3 py-1.5 text-sm transition ${
              category === key ? "bg-white text-ink" : "border border-line bg-panel text-muted hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
