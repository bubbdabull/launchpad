"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type TraitRow = { trait_type: string; value: string };

export function GenesisPassInspectModal(props: { assetMint: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [attrs, setAttrs] = useState<TraitRow[] | null>(null);
  const [name, setName] = useState<string>("");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/metadata/asset/${props.assetMint}`);
      const json = (await res.json()) as { name?: string; attributes?: TraitRow[]; message?: string };
      if (!res.ok) throw new Error(json.message ?? "Could not load metadata");
      setName(typeof json.name === "string" ? json.name : "");
      setAttrs(Array.isArray(json.attributes) ? json.attributes : []);
      setOpen(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void load()}
        disabled={loading}
        className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-medium text-white hover:border-accent/50 hover:text-accent disabled:opacity-50"
      >
        {loading ? "Loading traits…" : "Inspect pass"}
      </button>
      {err ? <p className="mt-2 text-xs text-red-400">{err}</p> : null}
      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-4 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl border border-white/15 bg-ink shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-white/10 px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Genesis Pass</p>
                <p className="mt-1 font-medium text-white">{name || props.assetMint}</p>
              </div>
              <div className="max-h-[55vh] overflow-y-auto px-5 py-4">
                <ul className="space-y-2">
                  {(attrs ?? []).map((a) => (
                    <li
                      key={`${a.trait_type}:${a.value}`}
                      className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2 text-sm"
                    >
                      <span className="text-muted">{a.trait_type}</span>
                      <span className="text-right font-medium text-white">{a.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border-t border-white/10 px-5 py-3">
                <button
                  type="button"
                  className="w-full rounded-full bg-accent py-2 text-sm font-semibold text-ink"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
