"use server";

import { revalidatePath } from "next/cache";

import { getWalletSession } from "@/lib/auth/session";
import { isCollectionCreator } from "@/lib/data/store-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type StoreManageState = { ok: boolean; message?: string };

export const storeManageInitialState: StoreManageState = { ok: false };

function asText(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function parsePriceCents(raw: string): number | null {
  const t = raw.replace(/[$,\s]/g, "");
  if (!t) return null;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export async function createStoreProduct(_prev: StoreManageState, form: FormData): Promise<StoreManageState> {
  const session = await getWalletSession();
  if (!session) return { ok: false, message: "Sign in to add products." };

  const slug = asText(form, "collection_slug").toLowerCase();
  if (!slug) return { ok: false, message: "Missing collection." };

  const allowed = await isCollectionCreator(slug, session.address);
  if (!allowed) return { ok: false, message: "You can only manage your own collections." };

  const name = asText(form, "name");
  const description = asText(form, "description");
  const imageUrl = asText(form, "image_url") || null;
  const priceCents = parsePriceCents(asText(form, "price"));
  const invRaw = asText(form, "inventory");
  const inventory = Number.parseInt(invRaw, 10);

  if (!name) return { ok: false, message: "Product name is required." };
  if (priceCents === null) return { ok: false, message: "Enter a valid price in USD (e.g. 24.99)." };
  if (!Number.isFinite(inventory) || inventory < 0) return { ok: false, message: "Inventory must be zero or more." };

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return { ok: false, message: "Server is not configured to save products yet." };
  }

  const { error } = await supabase.from("products").insert({
    collection_slug: slug,
    name,
    description,
    image_url: imageUrl,
    price_cents: priceCents,
    currency: "USD",
    inventory,
    active: true,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/project/${slug}/store`);
  revalidatePath(`/project/${slug}/store/manage`);
  revalidatePath("/shop");
  revalidatePath("/");
  return { ok: true, message: "Product added." };
}

export async function deleteStoreProduct(_prev: StoreManageState, form: FormData): Promise<StoreManageState> {
  const session = await getWalletSession();
  if (!session) return { ok: false, message: "Sign in first." };

  const slug = asText(form, "collection_slug").toLowerCase();
  const id = asText(form, "product_id");
  if (!slug || !id) return { ok: false, message: "Invalid request." };

  const allowed = await isCollectionCreator(slug, session.address);
  if (!allowed) return { ok: false, message: "Not allowed." };

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return { ok: false, message: "Server configuration error." };
  }

  const { error } = await supabase.from("products").delete().eq("id", id).eq("collection_slug", slug);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/project/${slug}/store`);
  revalidatePath(`/project/${slug}/store/manage`);
  revalidatePath("/shop");
  revalidatePath("/");
  return { ok: true, message: "Product removed." };
}

export async function setStoreProductActive(_prev: StoreManageState, form: FormData): Promise<StoreManageState> {
  const session = await getWalletSession();
  if (!session) return { ok: false, message: "Sign in first." };

  const slug = asText(form, "collection_slug").toLowerCase();
  const id = asText(form, "product_id");
  const active = asText(form, "active") === "true";
  if (!slug || !id) return { ok: false, message: "Invalid request." };

  const allowed = await isCollectionCreator(slug, session.address);
  if (!allowed) return { ok: false, message: "Not allowed." };

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return { ok: false, message: "Server configuration error." };
  }

  const { error } = await supabase.from("products").update({ active }).eq("id", id).eq("collection_slug", slug);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/project/${slug}/store`);
  revalidatePath(`/project/${slug}/store/manage`);
  revalidatePath("/shop");
  revalidatePath("/");
  return { ok: true, message: active ? "Product is live in the store." : "Product hidden from the store." };
}
