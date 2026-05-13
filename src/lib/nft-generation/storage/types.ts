import type { TraitCollectionConfig } from "@/lib/nft-generation/types";

export type RemotePinResult = { uri: string; provider: "arweave" | "shadow-drive" | "ipfs" | "https" };

/**
 * Storage abstraction for pinning images + JSON (implementations supplied per deployment).
 * Default stub throws — batch script writes to disk; production wires Irys / Shadow / NFT.Storage.
 */
export type GenesisAssetUploader = {
  uploadJson(name: string, body: unknown): Promise<RemotePinResult>;
  uploadPng(name: string, bytes: Buffer): Promise<RemotePinResult>;
};

export function createStubUploader(): GenesisAssetUploader {
  return {
    async uploadJson() {
      throw new Error("GenesisAssetUploader.uploadJson: configure an uploader (Arweave / Shadow Drive / IPFS).");
    },
    async uploadPng() {
      throw new Error("GenesisAssetUploader.uploadPng: configure an uploader (Arweave / Shadow Drive / IPFS).");
    },
  };
}
