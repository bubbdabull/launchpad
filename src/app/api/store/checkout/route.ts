/**
 * @apiRouteLayer L3
 */


import { NextResponse } from "next/server";

import { rateLimitOr429 } from "@/lib/security/apply-rate-limit";
import { envPositiveInt } from "@/lib/security/env-num";
import { readJsonBody } from "@/lib/security/request";
import { createServiceRoleClient } from "@/lib/supabase/server";

type CheckoutItem = { productId: string; qty: number };
type CheckoutBody = {
  collectionSlug?: string;
  buyerEmail?: string | null;
  items?: CheckoutItem[];
};

const MAX_LINE_ITEMS = 50;
const MAX_QTY_PER_LINE = 999;
const MAX_EMAIL_LEN = 320;

function getPlatformStoreFeeBps(): number {
  const raw = Number(process.env.PLATFORM_STORE_FEE_BPS ?? "250");
  if (!Number.isFinite(raw) || raw < 0) return 250;
  return Math.min(Math.floor(raw), 10_000);
}

export async function POST(req: Request) {
  const limited = rateLimitOr429(req, {
    prefix: "store:checkout",
    max: envPositiveInt("RATE_LIMIT_CHECKOUT_MAX", 60),
    windowMs: envPositiveInt("RATE_LIMIT_CHECKOUT_WINDOW_MS", 15 * 60 * 1000),
  });
  if (limited) return limited;

  const parsed = await readJsonBody<CheckoutBody>(req, 64 * 1024);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const body = parsed.data;
  const collectionSlug = String(body.collectionSlug ?? "").trim();
  const rawItems = body.items ?? [];
  let buyerEmail = body.buyerEmail?.trim() || null;
  if (buyerEmail && buyerEmail.length > MAX_EMAIL_LEN) {
    return NextResponse.json({ ok: false, error: "Email too long" }, { status: 400 });
  }

  if (!collectionSlug) {
    return NextResponse.json({ ok: false, error: "collectionSlug is required" }, { status: 400 });
  }
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return NextResponse.json({ ok: false, error: "At least one item is required" }, { status: 400 });
  }

  const mergedQty = new Map<string, number>();
  for (const item of rawItems) {
    const id = String(item.productId ?? "").trim();
    const q = Number(item.qty);
    if (!id || !Number.isFinite(q) || q < 1) {
      return NextResponse.json({ ok: false, error: "Invalid cart line." }, { status: 400 });
    }
    mergedQty.set(id, (mergedQty.get(id) ?? 0) + q);
  }

  const items = [...mergedQty.entries()].map(([productId, qty]) => ({ productId, qty }));
  if (items.length > MAX_LINE_ITEMS) {
    return NextResponse.json({ ok: false, error: "Too many line items" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return NextResponse.json({ ok: false, error: "Checkout is not configured." }, { status: 503 });
  }

  const ids = items.map((x) => x.productId);
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id,name,price_cents,currency,inventory,active,collection_slug")
    .in("id", ids);

  if (productsError || !products) {
    return NextResponse.json({ ok: false, error: productsError?.message ?? "Products not found" }, { status: 400 });
  }

  let subtotal = 0;
  const lineItems = items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product || !product.active || product.collection_slug !== collectionSlug) {
      throw new Error("Invalid product in cart");
    }
    const qty = Number(item.qty);
    if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY_PER_LINE || qty > product.inventory) {
      throw new Error(`Invalid qty for ${product.name}`);
    }
    const lineTotal = product.price_cents * qty;
    subtotal += lineTotal;
    return {
      product_id: product.id,
      name: product.name,
      qty,
      price_cents: product.price_cents,
      line_total_cents: lineTotal,
    };
  });

  try {
    const platformFeeBps = getPlatformStoreFeeBps();
    const platformFeeCents = Math.floor((subtotal * platformFeeBps) / 10_000);
    const creatorRevenueCents = subtotal - platformFeeCents;
    const totalCents = subtotal;

    const { data: order, error: insertError } = await supabase
      .from("orders")
      .insert({
        collection_slug: collectionSlug,
        buyer_email: buyerEmail,
        subtotal_cents: subtotal,
        platform_fee_bps: platformFeeBps,
        platform_fee_cents: platformFeeCents,
        creator_revenue_cents: creatorRevenueCents,
        total_cents: totalCents,
        currency: "USD",
        status: "pending",
        items: lineItems,
      })
      .select("id,platform_fee_cents,creator_revenue_cents,total_cents")
      .single();

    if (insertError || !order) {
      return NextResponse.json({ ok: false, error: insertError?.message ?? "Unable to create order" }, { status: 500 });
    }

    for (const li of lineItems) {
      const prod = products.find((p) => p.id === li.product_id);
      if (!prod) continue;
      const nextInv = prod.inventory - li.qty;
      const { error: invErr } = await supabase.from("products").update({ inventory: nextInv }).eq("id", prod.id);
      if (invErr) {
        console.error("inventory update", invErr);
      }
    }

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      feeBreakdown: {
        platformFeeCents: order.platform_fee_cents,
        creatorRevenueCents: order.creator_revenue_cents,
        totalCents: order.total_cents,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Checkout failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
