"use client";

import { useActionState } from "react";
import Image from "next/image";

import {
  createStoreProduct,
  deleteStoreProduct,
  setStoreProductActive,
  storeManageInitialState,
  type StoreManageState,
} from "@/app/project/[slug]/store/actions";
import type { Product } from "@/lib/data/store";

import { StoreProductImageField } from "./StoreProductImageField";

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function ProductManageClient({ slug, products }: { slug: string; products: Product[] }) {
  const [createState, createAction, createPending] = useActionState(createStoreProduct, storeManageInitialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteStoreProduct, storeManageInitialState);
  const [toggleState, toggleAction, togglePending] = useActionState(setStoreProductActive, storeManageInitialState);

  const busy = createPending || deletePending || togglePending;
  const flash = createState.message || deleteState.message || toggleState.message;
  const flashOk = createState.ok || deleteState.ok || toggleState.ok;

  return (
    <div className="space-y-10">
      {flash ? (
        <p className={`text-sm ${flashOk ? "text-emerald-300" : "text-rose-300"}`}>{flash}</p>
      ) : null}

      <section className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-[#121214] to-[#0c0c0e] p-6 sm:p-8">
        <h2 className="font-display text-lg font-semibold text-white">Add a product</h2>
        <p className="mt-1 text-sm text-muted">Merch, passes, or digital perks — priced in USD for this storefront.</p>
        <form action={createAction} className="mt-6 space-y-4">
          <input type="hidden" name="collection_slug" value={slug} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-white">Name</label>
              <input
                name="name"
                required
                placeholder="e.g. Hoodie — black"
                className="w-full rounded-xl border border-line bg-ink px-4 py-3 text-sm text-white"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-white">Description</label>
              <textarea
                name="description"
                rows={3}
                placeholder="Sizes, fulfillment, or download instructions"
                className="w-full rounded-xl border border-line bg-ink px-4 py-3 text-sm text-white"
              />
            </div>
            <StoreProductImageField />
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Price (USD)</label>
              <input
                name="price"
                required
                placeholder="29.99"
                inputMode="decimal"
                className="w-full rounded-xl border border-line bg-ink px-4 py-3 text-sm text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Stock count</label>
              <input
                name="inventory"
                required
                defaultValue="0"
                inputMode="numeric"
                className="w-full rounded-xl border border-line bg-ink px-4 py-3 text-sm text-white"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-accent px-8 py-3 text-sm font-semibold text-ink disabled:opacity-50"
          >
            {createPending ? "Saving…" : "Add product"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-white">Your catalog</h2>
        <p className="mt-1 text-sm text-muted">Hide a row to remove it from the public store without deleting history.</p>
        <ul className="mt-6 space-y-4">
          {products.length === 0 && <li className="text-sm text-muted">No products yet.</li>}
          {products.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-4 rounded-2xl border border-line bg-panel/50 p-4 sm:flex-row sm:items-center"
            >
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-ink">
                {p.image_url ? <Image src={p.image_url} alt="" fill className="object-cover" sizes="80px" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">{p.name}</p>
                <p className="text-xs text-muted">
                  {money(p.price_cents, p.currency)} · {p.inventory} in stock ·{" "}
                  <span className={p.active ? "text-emerald-300" : "text-amber-200"}>
                    {p.active ? "Live" : "Hidden"}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={toggleAction}>
                  <input type="hidden" name="collection_slug" value={slug} />
                  <input type="hidden" name="product_id" value={p.id} />
                  <input type="hidden" name="active" value={p.active ? "false" : "true"} />
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-full border border-line px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {p.active ? "Hide" : "Show"}
                  </button>
                </form>
                <form
                  action={deleteAction}
                  onSubmit={(e) => {
                    if (!confirm("Remove this product permanently?")) e.preventDefault();
                  }}
                >
                  <input type="hidden" name="collection_slug" value={slug} />
                  <input type="hidden" name="product_id" value={p.id} />
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-full border border-rose-500/40 px-4 py-2 text-xs font-medium text-rose-200 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
