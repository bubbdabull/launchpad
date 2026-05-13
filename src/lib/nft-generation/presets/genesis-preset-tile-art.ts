import type { GenesisBuiltinTraitPresetId } from "@/lib/nft-generation/presets/built-in-genesis-presets";

const W = 800;

/** Base palette anchor (same formulas as the original flat tiles). */
export function rgbForTile(
  preset: GenesisBuiltinTraitPresetId,
  layer: number,
  index: number,
): { r: number; g: number; b: number } {
  const bump = (layer * 37 + index * 73) % 200;
  switch (preset) {
    case "starter": {
      const base = [0x12, 0x16, 0x22] as const;
      return {
        r: Math.min(255, base[0] + bump),
        g: Math.min(255, base[1] + (layer + 1) * 40),
        b: Math.min(255, base[2] + (index + 1) * 55),
      };
    }
    case "aurora": {
      const r = Math.min(255, 40 + bump + index * 45);
      const g = Math.min(255, 25 + layer * 55 + index * 20);
      const b = Math.min(255, 90 + layer * 30 + index * 40);
      return { r, g, b };
    }
    case "ember": {
      const r = Math.min(255, 120 + bump + index * 35);
      const g = Math.min(255, 35 + layer * 25 + index * 15);
      const b = Math.min(255, 20 + layer * 12);
      return { r, g, b };
    }
    case "mono": {
      const v = Math.min(255, 32 + layer * 48 + index * 28 + (bump % 40));
      return { r: v, g: v, b: v };
    }
    case "neon": {
      const hues: Array<[number, number, number]> = [
        [0, 255, 140],
        [255, 0, 200],
        [80, 200, 255],
      ];
      const [hr, hg, hb] = hues[index % 3];
      const mix = 0.35 + layer * 0.2;
      return {
        r: Math.min(255, Math.round(hr * mix + bump * 0.4)),
        g: Math.min(255, Math.round(hg * mix + layer * 25)),
        b: Math.min(255, Math.round(hb * mix + index * 18)),
      };
    }
    case "meadow": {
      const r = Math.min(255, 18 + bump * 0.35 + index * 12);
      const g = Math.min(255, 55 + layer * 45 + index * 28 + bump * 0.25);
      const b = Math.min(255, 22 + layer * 15 + index * 10);
      return { r, g, b };
    }
    case "ocean": {
      const r = Math.min(255, 8 + layer * 8 + index * 5);
      const g = Math.min(255, 45 + bump * 0.4 + layer * 35);
      const b = Math.min(255, 85 + bump * 0.5 + index * 40 + layer * 25);
      return { r, g, b };
    }
    case "desert": {
      const r = Math.min(255, 110 + bump * 0.45 + index * 22);
      const g = Math.min(255, 72 + layer * 20 + index * 14);
      const b = Math.min(255, 38 + layer * 12 + index * 8);
      return { r, g, b };
    }
    case "royal": {
      const r = Math.min(255, 55 + bump * 0.35 + index * 30);
      const g = Math.min(255, 18 + layer * 22 + index * 8);
      const b = Math.min(255, 75 + layer * 40 + bump * 0.2);
      return { r, g, b };
    }
    case "retro": {
      const r = Math.min(255, 140 + bump * 0.25 + layer * 8);
      const g = Math.min(255, 118 + index * 12 + layer * 6);
      const b = Math.min(255, 88 + layer * 10 + (bump % 25));
      return { r, g, b };
    }
    default: {
      const _x: never = preset;
      return _x;
    }
  }
}

function hex(c: { r: number; g: number; b: number }): string {
  const f = (n: number) =>
    Math.min(255, Math.max(0, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${f(c.r)}${f(c.g)}${f(c.b)}`;
}

function shift(c: { r: number; g: number; b: number }, dr: number, dg: number, db: number): { r: number; g: number; b: number } {
  return {
    r: Math.min(255, Math.max(0, c.r + dr)),
    g: Math.min(255, Math.max(0, c.g + dg)),
    b: Math.min(255, Math.max(0, c.b + db)),
  };
}

/**
 * Playful 800×800 SVG doodles per preset (deterministic from layer + index).
 * Rasterized by the tile API route via Sharp.
 */
export function buildGenesisPresetTileSvg(preset: GenesisBuiltinTraitPresetId, layer: number, index: number): string {
  const base = rgbForTile(preset, layer, index);
  const a = hex(shift(base, 35, 40, 55));
  const b = hex(shift(base, -18, 22, 40));
  const c = hex(shift(base, 55, -25, -15));
  const d = hex(shift(base, 12, 48, -30));
  const e = hex(shift(base, -30, -20, 35));
  const bg = hex(base);
  const t = layer + index * 3;
  const rot = -12 + t * 7;

  const parts: string[] = [`<rect width="${W}" height="${W}" fill="${bg}"/>`];

  switch (preset) {
    case "starter": {
      parts.push(
        `<ellipse cx="400" cy="340" rx="240" ry="72" fill="none" stroke="${a}" stroke-width="10" opacity="0.45" transform="rotate(${rot} 400 340)"/>`,
        `<circle cx="${260 + index * 55}" cy="200" r="52" fill="${b}" opacity="0.55"/>`,
        `<circle cx="520" cy="160" r="18" fill="${c}" opacity="0.85"/>`,
        `<circle cx="560" cy="210" r="11" fill="${d}" opacity="0.7"/>`,
        `<circle cx="150" cy="520" r="14" fill="${e}" opacity="0.65"/>`,
        `<rect x="480" y="440" width="120" height="56" rx="12" fill="${a}" opacity="0.35" transform="rotate(${8 + layer * 5} 540 468)"/>`,
        `<polygon points="400,120 430,190 370,190" fill="${c}" opacity="0.4"/>`,
      );
      break;
    }
    case "aurora": {
      parts.push(
        `<circle cx="200" cy="180" r="140" fill="${a}" opacity="0.35"/>`,
        `<circle cx="620" cy="220" r="180" fill="${b}" opacity="0.28"/>`,
        `<circle cx="420" cy="520" r="200" fill="${c}" opacity="0.25"/>`,
        `<ellipse cx="400" cy="360" rx="300" ry="90" fill="${d}" opacity="0.2" transform="rotate(${rot} 400 360)"/>`,
        `<polygon points="120,600 180,480 240,600" fill="${e}" opacity="0.45"/>`,
        `<polygon points="680,580 620,460 740,520" fill="${a}" opacity="0.35"/>`,
      );
      break;
    }
    case "ember": {
      parts.push(
        `<polygon points="400,140 460,320 340,320" fill="${a}" opacity="0.55"/>`,
        `<polygon points="400,200 430,300 370,300" fill="${b}" opacity="0.7"/>`,
        `<circle cx="220" cy="480" r="90" fill="${c}" opacity="0.4"/>`,
        `<circle cx="580" cy="440" r="70" fill="${d}" opacity="0.45"/>`,
        `<rect x="320" y="520" width="160" height="40" rx="8" fill="${e}" opacity="0.5" transform="rotate(-6 400 540)"/>`,
        `<path d="M 100 650 Q 400 520 700 650 L 700 800 L 100 800 Z" fill="${a}" opacity="0.25"/>`,
      );
      break;
    }
    case "mono": {
      parts.push(
        `<rect x="120" y="140" width="200" height="200" rx="16" fill="${a}" opacity="0.5" transform="rotate(${rot} 220 240)"/>`,
        `<rect x="420" y="200" width="260" height="120" rx="10" fill="${b}" opacity="0.4"/>`,
        `<circle cx="400" cy="480" r="120" fill="none" stroke="${c}" stroke-width="24" opacity="0.35"/>`,
        `<line x1="60" y1="320" x2="740" y2="280" stroke="${d}" stroke-width="6" opacity="0.3"/>`,
        `<line x1="80" y1="600" x2="720" y2="560" stroke="${e}" stroke-width="4" opacity="0.35"/>`,
      );
      break;
    }
    case "neon": {
      const gx = 100 + index * 40;
      const gy = 80 + layer * 50;
      parts.push(
        `<rect x="${gx}" y="${gy}" width="600" height="14" fill="${a}" opacity="0.55"/>`,
        `<rect x="${gx - 40}" y="${gy + 200}" width="14" height="420" fill="${b}" opacity="0.5"/>`,
        `<rect x="${gx + 200}" y="${gy + 120}" width="14" height="380" fill="${c}" opacity="0.45"/>`,
        `<circle cx="400" cy="400" r="130" fill="none" stroke="${d}" stroke-width="16" opacity="0.75"/>`,
        `<circle cx="400" cy="400" r="85" fill="${e}" opacity="0.25"/>`,
        `<rect x="300" y="620" width="200" height="60" rx="10" fill="${a}" opacity="0.4"/>`,
      );
      break;
    }
    case "meadow": {
      const stemX = 400 + (index - 1) * 80;
      parts.push(
        `<ellipse cx="${stemX - 40}" cy="380" rx="90" ry="44" fill="${a}" opacity="0.55" transform="rotate(-35 ${stemX - 40} 380)"/>`,
        `<ellipse cx="${stemX + 50}" cy="360" rx="85" ry="40" fill="${b}" opacity="0.5" transform="rotate(40 ${stemX + 50} 360)"/>`,
        `<ellipse cx="${stemX}" cy="300" rx="70" ry="36" fill="${c}" opacity="0.45" transform="rotate(${rot} ${stemX} 300)"/>`,
        `<line x1="${stemX}" y1="420" x2="${stemX}" y2="620" stroke="${d}" stroke-width="14" stroke-linecap="round" opacity="0.5"/>`,
        `<circle cx="${stemX}" cy="220" r="28" fill="${e}" opacity="0.65"/>`,
        `<circle cx="${stemX - 35}" cy="200" r="10" fill="${a}" opacity="0.7"/>`,
        `<circle cx="${stemX + 35}" cy="205" r="10" fill="${b}" opacity="0.7"/>`,
        `<circle cx="${stemX}" cy="175" r="8" fill="${c}" opacity="0.75"/>`,
      );
      break;
    }
    case "ocean": {
      parts.push(
        `<ellipse cx="200" cy="320" rx="160" ry="70" fill="${a}" opacity="0.35"/>`,
        `<ellipse cx="520" cy="280" rx="200" ry="80" fill="${b}" opacity="0.3"/>`,
        `<circle cx="150" cy="180" r="22" fill="${c}" opacity="0.5"/>`,
        `<circle cx="220" cy="140" r="14" fill="${d}" opacity="0.45"/>`,
        `<circle cx="620" cy="200" r="28" fill="${c}" opacity="0.4"/>`,
        `<circle cx="680" cy="240" r="16" fill="${a}" opacity="0.45"/>`,
        `<path d="M 0 ${480 + layer * 20} Q 200 ${420 + index * 15} 400 ${480 + layer * 10} T 800 ${470 + index * 12} L 800 800 L 0 800 Z" fill="${e}" opacity="0.35"/>`,
        `<polygon points="520,520 580,420 640,520" fill="${b}" opacity="0.4"/>`,
      );
      break;
    }
    case "desert": {
      parts.push(
        `<circle cx="620" cy="160" r="56" fill="${a}" opacity="0.55"/>`,
        `<polygon points="0,520 300,380 600,460 800,420 800,800 0,800" fill="${b}" opacity="0.45"/>`,
        `<polygon points="0,580 400,480 800,540 800,800 0,800" fill="${c}" opacity="0.35"/>`,
        `<rect x="360" y="320" width="24" height="140" rx="8" fill="${d}" opacity="0.5"/>`,
        `<ellipse cx="372" cy="300" rx="40" ry="16" fill="${e}" opacity="0.45"/>`,
        `<polygon points="180,520 220,420 260,520" fill="${a}" opacity="0.4"/>`,
      );
      break;
    }
    case "royal": {
      parts.push(
        `<polygon points="400,120 460,220 560,240 490,310 510,420 400,360 290,420 310,310 240,240 340,220" fill="${a}" opacity="0.45"/>`,
        `<polygon points="400,180 430,250 500,265 445,315 460,380 400,330 340,380 355,315 300,265 370,250" fill="${b}" opacity="0.55"/>`,
        `<circle cx="280" cy="520" r="40" fill="${c}" opacity="0.6"/>`,
        `<circle cx="520" cy="520" r="40" fill="${d}" opacity="0.6"/>`,
        `<rect x="360" y="480" width="80" height="100" rx="6" fill="${e}" opacity="0.45"/>`,
        `<polygon points="400,460 420,520 380,520" fill="${a}" opacity="0.7"/>`,
      );
      break;
    }
    case "retro": {
      parts.push(
        `<rect x="220" y="260" width="360" height="220" rx="18" fill="${a}" opacity="0.55" stroke="${b}" stroke-width="6"/>`,
        `<rect x="240" y="290" width="320" height="70" rx="8" fill="${c}" opacity="0.5"/>`,
        `<rect x="240" y="380" width="320" height="70" rx="8" fill="${d}" opacity="0.45"/>`,
        `<circle cx="400" cy="365" r="22" fill="${e}" opacity="0.7"/>`,
        `<circle cx="400" cy="455" r="22" fill="${b}" opacity="0.65"/>`,
        `<rect x="180" y="520" width="440" height="28" rx="6" fill="${c}" opacity="0.4"/>`,
        `<rect x="300" y="160" width="16" height="48" rx="3" fill="${d}" opacity="0.45"/>`,
        `<rect x="330" y="140" width="16" height="68" rx="3" fill="${a}" opacity="0.45"/>`,
        `<rect x="360" y="175" width="16" height="33" rx="3" fill="${e}" opacity="0.45"/>`,
        `<rect x="390" y="150" width="16" height="58" rx="3" fill="${b}" opacity="0.45"/>`,
        `<rect x="420" y="168" width="16" height="40" rx="3" fill="${d}" opacity="0.45"/>`,
      );
      break;
    }
    default: {
      const _n: never = preset;
      return _n;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">${parts.join("")}</svg>`;
}
