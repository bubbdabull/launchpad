import type { TraitCollectionConfig } from "@/lib/nft-generation/types";

/** Preset ids accepted by `/api/genesis-presets/tile` and create/manage forms. */
export const GENESIS_BUILTIN_TRAIT_PRESET_IDS = [
  "starter",
  "aurora",
  "ember",
  "mono",
  "neon",
  "meadow",
  "ocean",
  "desert",
  "royal",
  "retro",
] as const;

export type GenesisBuiltinTraitPresetId = (typeof GENESIS_BUILTIN_TRAIT_PRESET_IDS)[number];

/** @deprecated Use `GENESIS_BUILTIN_TRAIT_PRESET_IDS[0]` or preset id type — kept for call sites that still reference the name. */
export const GENESIS_TRAIT_PRESET_STARTER: GenesisBuiltinTraitPresetId = "starter";

export function isGenesisBuiltinTraitPresetId(value: string): value is GenesisBuiltinTraitPresetId {
  return (GENESIS_BUILTIN_TRAIT_PRESET_IDS as readonly string[]).includes(value);
}

export const GENESIS_BUILTIN_PRESET_OPTIONS: ReadonlyArray<{
  id: GenesisBuiltinTraitPresetId;
  label: string;
  blurb: string;
}> = [
  { id: "starter", label: "Starter — deep space", blurb: "Cool blues, three balanced layers." },
  { id: "aurora", label: "Aurora — polar glow", blurb: "Purples and teals, softer gradients in tiles." },
  { id: "ember", label: "Ember — forge heat", blurb: "Warm reds and ambers." },
  { id: "mono", label: "Mono — ink & paper", blurb: "Grayscale, minimal contrast." },
  { id: "neon", label: "Neon — arcade grid", blurb: "High-saturation accent colors." },
  { id: "meadow", label: "Meadow — leaf & light", blurb: "Forest greens and soft highlights." },
  { id: "ocean", label: "Ocean — depth & foam", blurb: "Deep blues and sea-glass cyans." },
  { id: "desert", label: "Desert — dune & sun", blurb: "Warm sands and sun-baked stone." },
  { id: "royal", label: "Royal — velvet & gold", blurb: "Regal purples and burnished metal." },
  { id: "retro", label: "Retro — print & paste", blurb: "Analog creams, sepia, and faded ink." },
];

function tileUrl(publicOrigin: string, preset: GenesisBuiltinTraitPresetId, layer: number, index: number): string {
  const base = publicOrigin.replace(/\/+$/, "");
  return `${base}/api/genesis-presets/tile?p=${encodeURIComponent(preset)}&l=${layer}&i=${index}`;
}

function layerBlock(
  publicOrigin: string,
  preset: GenesisBuiltinTraitPresetId,
  spec: {
    layers: Array<{
      id: string;
      displayName: string;
      order: number;
      traits: Array<{ id: string; name: string; weight: number; tier: "Common" | "Rare" | "Epic" | "Legendary" }>;
    }>;
  },
): TraitCollectionConfig["layers"] {
  return spec.layers.map((layer) => ({
    id: layer.id,
    displayName: layer.displayName,
    order: layer.order,
    traits: layer.traits.map((t, ti) => ({
      ...t,
      file: tileUrl(publicOrigin, preset, layer.order, ti),
    })),
  }));
}

export function buildGenesisBuiltinTraitConfig(
  preset: GenesisBuiltinTraitPresetId,
  publicOrigin: string,
): TraitCollectionConfig {
  const common = {
    schemaVersion: 1 as const,
    width: 800,
    height: 800,
  };

  switch (preset) {
    case "starter":
      return {
        ...common,
        backgroundColor: "#0b0f14",
        layers: layerBlock(publicOrigin, preset, {
          layers: [
            {
              id: "backdrop",
              displayName: "Backdrop",
              order: 0,
              traits: [
                { id: "abyss", name: "Abyss", weight: 52, tier: "Common" },
                { id: "signal", name: "Signal", weight: 33, tier: "Rare" },
                { id: "flare", name: "Flare", weight: 15, tier: "Epic" },
              ],
            },
            {
              id: "core",
              displayName: "Core",
              order: 1,
              traits: [
                { id: "pulse", name: "Pulse", weight: 48, tier: "Common" },
                { id: "lattice", name: "Lattice", weight: 35, tier: "Rare" },
                { id: "forge", name: "Forge", weight: 17, tier: "Legendary" },
              ],
            },
            {
              id: "halo",
              displayName: "Halo",
              order: 2,
              traits: [
                { id: "quiet", name: "Quiet", weight: 45, tier: "Common" },
                { id: "ion", name: "Ion", weight: 38, tier: "Rare" },
                { id: "crown", name: "Crown", weight: 17, tier: "Epic" },
              ],
            },
          ],
        }),
      };

    case "aurora":
      return {
        ...common,
        backgroundColor: "#0a0618",
        layers: layerBlock(publicOrigin, preset, {
          layers: [
            {
              id: "veil",
              displayName: "Veil",
              order: 0,
              traits: [
                { id: "nocturne", name: "Nocturne", weight: 50, tier: "Common" },
                { id: "violet_frost", name: "Violet Frost", weight: 35, tier: "Rare" },
                { id: "polar_shift", name: "Polar Shift", weight: 15, tier: "Epic" },
              ],
            },
            {
              id: "tide",
              displayName: "Tide",
              order: 1,
              traits: [
                { id: "shoal", name: "Shoal", weight: 46, tier: "Common" },
                { id: "biolume", name: "Biolume", weight: 36, tier: "Rare" },
                { id: "deep_current", name: "Deep Current", weight: 18, tier: "Legendary" },
              ],
            },
            {
              id: "glow",
              displayName: "Glow",
              order: 2,
              traits: [
                { id: "afterglow", name: "Afterglow", weight: 44, tier: "Common" },
                { id: "ribbon", name: "Ribbon", weight: 38, tier: "Rare" },
                { id: "cascade", name: "Cascade", weight: 18, tier: "Epic" },
              ],
            },
          ],
        }),
      };

    case "ember":
      return {
        ...common,
        backgroundColor: "#140805",
        layers: layerBlock(publicOrigin, preset, {
          layers: [
            {
              id: "bed",
              displayName: "Bed",
              order: 0,
              traits: [
                { id: "cinder", name: "Cinder", weight: 51, tier: "Common" },
                { id: "ember_glow", name: "Ember Glow", weight: 34, tier: "Rare" },
                { id: "magma", name: "Magma", weight: 15, tier: "Epic" },
              ],
            },
            {
              id: "spark",
              displayName: "Spark",
              order: 1,
              traits: [
                { id: "flicker", name: "Flicker", weight: 47, tier: "Common" },
                { id: "arc", name: "Arc", weight: 35, tier: "Rare" },
                { id: "wildfire", name: "Wildfire", weight: 18, tier: "Legendary" },
              ],
            },
            {
              id: "smoke",
              displayName: "Smoke",
              order: 2,
              traits: [
                { id: "ash", name: "Ash", weight: 46, tier: "Common" },
                { id: "haze", name: "Haze", weight: 37, tier: "Rare" },
                { id: "obsidian", name: "Obsidian", weight: 17, tier: "Epic" },
              ],
            },
          ],
        }),
      };

    case "mono":
      return {
        ...common,
        backgroundColor: "#0c0c0c",
        layers: layerBlock(publicOrigin, preset, {
          layers: [
            {
              id: "tone",
              displayName: "Tone",
              order: 0,
              traits: [
                { id: "mist", name: "Mist", weight: 52, tier: "Common" },
                { id: "slate", name: "Slate", weight: 33, tier: "Rare" },
                { id: "charcoal", name: "Charcoal", weight: 15, tier: "Epic" },
              ],
            },
            {
              id: "texture",
              displayName: "Texture",
              order: 1,
              traits: [
                { id: "grain", name: "Grain", weight: 48, tier: "Common" },
                { id: "weave", name: "Weave", weight: 35, tier: "Rare" },
                { id: "etched", name: "Etched", weight: 17, tier: "Legendary" },
              ],
            },
            {
              id: "rim",
              displayName: "Rim",
              order: 2,
              traits: [
                { id: "thin_line", name: "Thin Line", weight: 45, tier: "Common" },
                { id: "silver", name: "Silver", weight: 38, tier: "Rare" },
                { id: "platinum", name: "Platinum", weight: 17, tier: "Epic" },
              ],
            },
          ],
        }),
      };

    case "neon":
      return {
        ...common,
        backgroundColor: "#050308",
        layers: layerBlock(publicOrigin, preset, {
          layers: [
            {
              id: "grid",
              displayName: "Grid",
              order: 0,
              traits: [
                { id: "scanline", name: "Scanline", weight: 50, tier: "Common" },
                { id: "matrix", name: "Matrix", weight: 35, tier: "Rare" },
                { id: "overload", name: "Overload", weight: 15, tier: "Epic" },
              ],
            },
            {
              id: "surge",
              displayName: "Surge",
              order: 1,
              traits: [
                { id: "jolt", name: "Jolt", weight: 46, tier: "Common" },
                { id: "phosphor", name: "Phosphor", weight: 36, tier: "Rare" },
                { id: "hyper", name: "Hyper", weight: 18, tier: "Legendary" },
              ],
            },
            {
              id: "glitch",
              displayName: "Glitch",
              order: 2,
              traits: [
                { id: "static", name: "Static", weight: 44, tier: "Common" },
                { id: "tear", name: "Tear", weight: 38, tier: "Rare" },
                { id: "artifact", name: "Artifact", weight: 18, tier: "Epic" },
              ],
            },
          ],
        }),
      };

    case "meadow":
      return {
        ...common,
        backgroundColor: "#071208",
        layers: layerBlock(publicOrigin, preset, {
          layers: [
            {
              id: "canopy",
              displayName: "Canopy",
              order: 0,
              traits: [
                { id: "moss", name: "Moss", weight: 51, tier: "Common" },
                { id: "fern", name: "Fern", weight: 34, tier: "Rare" },
                { id: "evergreen", name: "Evergreen", weight: 15, tier: "Epic" },
              ],
            },
            {
              id: "leaf",
              displayName: "Leaf",
              order: 1,
              traits: [
                { id: "sprout", name: "Sprout", weight: 47, tier: "Common" },
                { id: "clover", name: "Clover", weight: 35, tier: "Rare" },
                { id: "vine", name: "Vine", weight: 18, tier: "Legendary" },
              ],
            },
            {
              id: "bloom",
              displayName: "Bloom",
              order: 2,
              traits: [
                { id: "dew", name: "Dew", weight: 45, tier: "Common" },
                { id: "pollen", name: "Pollen", weight: 37, tier: "Rare" },
                { id: "petal", name: "Petal", weight: 18, tier: "Epic" },
              ],
            },
          ],
        }),
      };

    case "ocean":
      return {
        ...common,
        backgroundColor: "#031018",
        layers: layerBlock(publicOrigin, preset, {
          layers: [
            {
              id: "depth",
              displayName: "Depth",
              order: 0,
              traits: [
                { id: "trench", name: "Trench", weight: 50, tier: "Common" },
                { id: "abyssal", name: "Abyssal", weight: 35, tier: "Rare" },
                { id: "midnight", name: "Midnight", weight: 15, tier: "Epic" },
              ],
            },
            {
              id: "reef",
              displayName: "Reef",
              order: 1,
              traits: [
                { id: "kelp", name: "Kelp", weight: 46, tier: "Common" },
                { id: "coral", name: "Coral", weight: 36, tier: "Rare" },
                { id: "anemone", name: "Anemone", weight: 18, tier: "Legendary" },
              ],
            },
            {
              id: "foam",
              displayName: "Foam",
              order: 2,
              traits: [
                { id: "spray", name: "Spray", weight: 44, tier: "Common" },
                { id: "breaker", name: "Breaker", weight: 38, tier: "Rare" },
                { id: "pearl", name: "Pearl", weight: 18, tier: "Epic" },
              ],
            },
          ],
        }),
      };

    case "desert":
      return {
        ...common,
        backgroundColor: "#141008",
        layers: layerBlock(publicOrigin, preset, {
          layers: [
            {
              id: "dune",
              displayName: "Dune",
              order: 0,
              traits: [
                { id: "silt", name: "Silt", weight: 52, tier: "Common" },
                { id: "ochre", name: "Ochre", weight: 33, tier: "Rare" },
                { id: "sienna", name: "Sienna", weight: 15, tier: "Epic" },
              ],
            },
            {
              id: "mesa",
              displayName: "Mesa",
              order: 1,
              traits: [
                { id: "crack", name: "Crack", weight: 48, tier: "Common" },
                { id: "plateau", name: "Plateau", weight: 35, tier: "Rare" },
                { id: "monolith", name: "Monolith", weight: 17, tier: "Legendary" },
              ],
            },
            {
              id: "mirage",
              displayName: "Mirage",
              order: 2,
              traits: [
                { id: "heat", name: "Heat", weight: 45, tier: "Common" },
                { id: "shimmer", name: "Shimmer", weight: 38, tier: "Rare" },
                { id: "oasis", name: "Oasis", weight: 17, tier: "Epic" },
              ],
            },
          ],
        }),
      };

    case "royal":
      return {
        ...common,
        backgroundColor: "#0c0614",
        layers: layerBlock(publicOrigin, preset, {
          layers: [
            {
              id: "velvet",
              displayName: "Velvet",
              order: 0,
              traits: [
                { id: "wine", name: "Wine", weight: 50, tier: "Common" },
                { id: "amethyst", name: "Amethyst", weight: 35, tier: "Rare" },
                { id: "imperial", name: "Imperial", weight: 15, tier: "Epic" },
              ],
            },
            {
              id: "seal",
              displayName: "Seal",
              order: 1,
              traits: [
                { id: "wax", name: "Wax", weight: 47, tier: "Common" },
                { id: "crest", name: "Crest", weight: 35, tier: "Rare" },
                { id: "sigil", name: "Sigil", weight: 18, tier: "Legendary" },
              ],
            },
            {
              id: "regalia",
              displayName: "Regalia",
              order: 2,
              traits: [
                { id: "filigree", name: "Filigree", weight: 44, tier: "Common" },
                { id: "gilded", name: "Gilded", weight: 38, tier: "Rare" },
                { id: "diadem", name: "Diadem", weight: 18, tier: "Epic" },
              ],
            },
          ],
        }),
      };

    case "retro":
      return {
        ...common,
        backgroundColor: "#161210",
        layers: layerBlock(publicOrigin, preset, {
          layers: [
            {
              id: "paper",
              displayName: "Paper",
              order: 0,
              traits: [
                { id: "newsprint", name: "Newsprint", weight: 51, tier: "Common" },
                { id: "cardstock", name: "Cardstock", weight: 34, tier: "Rare" },
                { id: "vellum", name: "Vellum", weight: 15, tier: "Epic" },
              ],
            },
            {
              id: "ink",
              displayName: "Ink",
              order: 1,
              traits: [
                { id: "stamp", name: "Stamp", weight: 46, tier: "Common" },
                { id: "mimeo", name: "Mimeo", weight: 36, tier: "Rare" },
                { id: "xerox", name: "Xerox", weight: 18, tier: "Legendary" },
              ],
            },
            {
              id: "fade",
              displayName: "Fade",
              order: 2,
              traits: [
                { id: "sunfade", name: "Sunfade", weight: 45, tier: "Common" },
                { id: "sepia", name: "Sepia", weight: 37, tier: "Rare" },
                { id: "polaroid", name: "Polaroid", weight: 18, tier: "Epic" },
              ],
            },
          ],
        }),
      };

    default: {
      const _exhaustive: never = preset;
      return _exhaustive;
    }
  }
}

/** @deprecated Use `buildGenesisBuiltinTraitConfig("starter", origin)`. */
export function buildStarterGenesisTraitConfig(publicOrigin: string): TraitCollectionConfig {
  return buildGenesisBuiltinTraitConfig("starter", publicOrigin);
}
