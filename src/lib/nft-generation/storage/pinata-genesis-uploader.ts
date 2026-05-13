import type { GenesisAssetUploader, RemotePinResult } from "@/lib/nft-generation/storage/types";

const PIN_JSON = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
const PIN_FILE = "https://api.pinata.cloud/pinning/pinFileToIPFS";

function gatewayBase(): string {
  const g = process.env.PINATA_GATEWAY_URL?.trim().replace(/\/$/, "");
  if (g) return g;
  return "https://gateway.pinata.cloud";
}

function ipfsUri(cid: string): RemotePinResult {
  const base = gatewayBase();
  const uri = base.includes("/ipfs/") ? `${base.replace(/\/$/, "")}/${cid}` : `${base}/ipfs/${cid}`;
  return { uri, provider: "ipfs" };
}

/**
 * Pin metadata + PNGs to IPFS via Pinata (https://pinata.cloud).
 * Server-only: pass `jwt` from `process.env.PINATA_JWT` in API routes or scripts.
 */
export function createPinataGenesisUploader(jwt: string): GenesisAssetUploader {
  const auth = jwt.trim();
  if (!auth) throw new Error("createPinataGenesisUploader: empty JWT.");

  async function pinJson(name: string, body: unknown): Promise<RemotePinResult> {
    const res = await fetch(PIN_JSON, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        pinataContent: body,
        pinataMetadata: { name },
        pinataOptions: { cidVersion: 1 },
      }),
    });
    const json = (await res.json()) as { IpfsHash?: string; error?: { reason?: string } };
    if (!res.ok) {
      throw new Error(`Pinata JSON pin failed: ${json.error?.reason ?? res.statusText}`);
    }
    const cid = json.IpfsHash;
    if (!cid) throw new Error("Pinata JSON pin: missing IpfsHash.");
    return ipfsUri(cid);
  }

  async function pinPng(name: string, bytes: Buffer): Promise<RemotePinResult> {
    const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
    const form = new FormData();
    form.append("file", blob, name.endsWith(".png") ? name : `${name}.png`);
    form.append(
      "pinataMetadata",
      JSON.stringify({
        name,
      }),
    );
    form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

    const res = await fetch(PIN_FILE, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth}` },
      body: form,
    });
    const json = (await res.json()) as { IpfsHash?: string; error?: { reason?: string } };
    if (!res.ok) {
      throw new Error(`Pinata file pin failed: ${json.error?.reason ?? res.statusText}`);
    }
    const cid = json.IpfsHash;
    if (!cid) throw new Error("Pinata file pin: missing IpfsHash.");
    return ipfsUri(cid);
  }

  return {
    uploadJson: pinJson,
    uploadPng: pinPng,
  };
}

/** Uses `PINATA_JWT` from the environment when set. */
export function createPinataGenesisUploaderFromEnv(): GenesisAssetUploader {
  const jwt = process.env.PINATA_JWT?.trim();
  if (!jwt) {
    throw new Error(
      "Missing PINATA_JWT. Add it to the repo root `.env.local` (recommended) or export it in your shell. " +
        "The `generate:genesis-collection` script loads `.env` / `.env.local` before `--pinata`.",
    );
  }
  return createPinataGenesisUploader(jwt);
}
