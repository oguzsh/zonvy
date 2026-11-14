// Dev-time only: draws Zonvy's icons as PNGs with no image libraries.
// Usage: `pnpm icons` -> writes tray icons, then `pnpm tauri icon` builds the app icon set.
//
// The glyph is a clock face: a ring, a minute hand at 12 and an hour hand toward 4.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ICONS = join(ROOT, "src-tauri", "icons");
const SUPERSAMPLE = 4;

type Rgba = readonly [number, number, number, number];
/** Returns the color at (x, y) in a unit square (0..1), or null for transparent. */
type Painter = (x: number, y: number) => Rgba | null;

const BLACK: Rgba = [0, 0, 0, 255];
const WHITE: Rgba = [255, 255, 255, 255];

// ---- geometry (unit square) ----

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** True when (x, y) is on the clock glyph centered in a box of `scale` (1 = full square). */
function onClock(x: number, y: number, scale: number, stroke: number): boolean {
  const c = 0.5;
  const r = 0.36 * scale;
  const w = stroke * scale;
  const ring = Math.abs(Math.hypot(x - c, y - c) - r) <= w / 2;
  const minute = distToSegment(x, y, c, c, c, c - r * 0.62) <= w / 2;
  const angle = (120 * Math.PI) / 180; // toward 4 o'clock
  const hour = distToSegment(x, y, c, c, c + Math.sin(angle) * r * 0.45, c - Math.cos(angle) * r * 0.45) <= w / 2;
  return ring || minute || hour;
}

function inRoundedSquare(x: number, y: number, inset: number, radius: number): boolean {
  const lo = inset + radius;
  const hi = 1 - inset - radius;
  const qx = Math.max(lo - x, 0, x - hi);
  const qy = Math.max(lo - y, 0, y - hi);
  return Math.hypot(qx, qy) <= radius && x >= inset && x <= 1 - inset && y >= inset && y <= 1 - inset;
}

function brandGradient(x: number, y: number): Rgba {
  const t = (x + y) / 2; // #0A84FF -> #5E5CE6, top-left to bottom-right
  return [Math.round(10 + t * 84), Math.round(132 - t * 40), Math.round(255 - t * 25), 255];
}

// ---- painters ----

/** macOS menu bar template: black glyph on transparent; the OS tints it. */
const trayTemplate: Painter = (x, y) => (onClock(x, y, 1.12, 0.1) ? BLACK : null);

/** Windows/Linux tray: white glyph on a brand-colored disc, readable on any taskbar. */
const trayColor: Painter = (x, y) => {
  if (Math.hypot(x - 0.5, y - 0.5) > 0.48) return null;
  return onClock(x, y, 1.05, 0.11) ? WHITE : brandGradient(x, y);
};

/** App icon: rounded square in the brand gradient with a white clock. */
const appIcon: Painter = (x, y) => {
  if (!inRoundedSquare(x, y, 0.08, 0.19)) return null;
  return onClock(x, y, 0.85, 0.08) ? WHITE : brandGradient(x, y);
};

// ---- rasterize + encode ----

function rasterize(size: number, paint: Painter): Buffer {
  const pixels = Buffer.alloc(size * size * 4);
  const samples = SUPERSAMPLE * SUPERSAMPLE;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const color = paint((px + (sx + 0.5) / SUPERSAMPLE) / size, (py + (sy + 0.5) / SUPERSAMPLE) / size);
          if (!color) continue;
          const alpha = color[3] / 255;
          r += color[0] * alpha; g += color[1] * alpha; b += color[2] * alpha; a += alpha;
        }
      }
      const i = (py * size + px) * 4;
      pixels[i] = a ? Math.round(r / a) : 0;
      pixels[i + 1] = a ? Math.round(g / a) : 0;
      pixels[i + 2] = a ? Math.round(b / a) : 0;
      pixels[i + 3] = Math.round((a / samples) * 255);
    }
  }
  return pixels;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

function encodePng(size: number, rgba: Buffer): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA, no interlace
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function write(file: string, size: number, paint: Painter): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, encodePng(size, rasterize(size, paint)));
  console.log(`Wrote ${file} (${size}×${size})`);
}

write(join(ICONS, "tray-template.png"), 44, trayTemplate);
write(join(ICONS, "tray.png"), 32, trayColor);
write(join(ROOT, "scripts", "app-icon.png"), 1024, appIcon);
