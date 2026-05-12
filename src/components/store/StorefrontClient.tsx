"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

type Product = {
  id: string;
  collection_slug: string;
  name: string;
  description: string;
  image_url: string | null;
  price_cents: number;
  currency: string;
  inventory: number;
  active: boolean;
};

type CartItem = Product & { qty: number };

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function StorefrontClient({ slug, products }: { slug: string; products: Product[] }) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const items = Object.values(cart);
  const subtotal = useMemo(
    () => items.reduce((sum, x) => sum + x.price_cents * x.qty, 0),
    [items],
  );
  const platformFeeBps = Number(process.env.NEXT_PUBLIC_PLATFORM_STORE_FEE_BPS ?? "250");
  const normalizedPlatformFeeBps =
    Number.isFinite(platformFeeBps) && platformFeeBps >= 0
      ? Math.min(Math.floor(platformFeeBps), 10_000)
      : 250;
  const platformFeeCents = Math.floor((subtotal * normalizedPlatformFeeBps) / 10_000);

  function add(p: Product) {
    setCart((prev) => {
      const existing = prev[p.id];
      const nextQty = Math.min((existing?.qty ?? 0) + 1, Math.max(1, p.inventory));
      return { ...prev, [p.id]: { ...p, qty: nextQty } };
    });
  }

  function remove(id: string) {
    setCart((prev) => {
      const clone = { ...prev };
      delete clone[id];
      return clone;
    });
  }

  async function checkout() {
    if (items.length === 0) {
      setMsg("Add at least one product to cart.");
      return;
    }
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          collectionSlug: slug,
          buyerEmail: email || null,
          items: items.map((x) => ({ productId: x.id, qty: x.qty })),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        orderId?: string;
        error?: string;
        feeBreakdown?: {
          platformFeeCents: number;
          creatorRevenueCents: number;
          totalCents: number;
        };
      };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Checkout failed");
      setCart({});
      router.push(`/project/${slug}/store/complete?orderId=${encodeURIComponent(data.orderId ?? "")}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-4">
        {products.length === 0 && (
          <div className="rounded-2xl border border-line bg-panel/60 p-5 text-sm text-muted">
            No products yet for this project storefront.
          </div>
        )}
        {products.map((p) => (
          <div key={p.id} className="flex gap-4 rounded-2xl border border-line bg-panel/60 p-4">
            <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-line bg-ink">
              {p.image_url ? (
                <Image src={p.image_url} alt={p.name} fill className="object-cover" />
              ) : null}
            </div>
            <div className="flex-1">
              <p className="font-medium text-white">{p.name}</p>
              <p className="mt-1 text-sm text-muted">{p.description}</p>
              <p className="mt-2 text-sm text-white">{money(p.price_cents, p.currency)}</p>
            </div>
            <button
              type="button"
              onClick={() => add(p)}
              className="h-fit rounded-full bg-accent px-4 py-2 text-xs font-semibold text-ink hover:brightness-110"
            >
              Add
            </button>
          </div>
        ))}
      </div>

      <div className="h-fit rounded-2xl border border-line bg-panel/60 p-5">
        <p className="text-sm font-semibold text-white">Cart</p>
        <div className="mt-3 space-y-2">
          {items.length === 0 && <p className="text-sm text-muted">Cart is empty.</p>}
          {items.map((x) => (
            <div key={x.id} className="flex items-center justify-between text-sm">
              <p className="text-white">
                {x.name} × {x.qty}
              </p>
              <button className="text-muted hover:text-white" onClick={() => remove(x.id)} type="button">
                Remove
              </button>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">Subtotal</p>
        <p className="text-lg font-semibold text-white">{money(subtotal, "USD")}</p>
        <p className="mt-2 text-xs text-muted">
          Estimated total includes a {(normalizedPlatformFeeBps / 100).toFixed(2)}% platform fee (
          {money(platformFeeCents, "USD")}). The rest goes to the creator after checkout.
        </p>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email for order updates (optional)"
          className="mt-4 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm text-white"
        />
        <button
          type="button"
          disabled={submitting}
          onClick={checkout}
          className="mt-4 w-full rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-60"
        >
          {submitting ? "Creating order..." : "Checkout"}
        </button>
        {msg && <p className="mt-3 text-xs text-muted">{msg}</p>}
      </div>
    </div>
  );
}

