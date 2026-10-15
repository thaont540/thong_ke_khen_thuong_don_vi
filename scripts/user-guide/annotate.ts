/// <reference lib="dom" />
// DOM lib: the callout overlay is built inside page.evaluate (browser context).
/**
 * Screenshot helper: draws numbered red callouts (badge + outline box) over target elements with a
 * temporary absolutely-positioned overlay, takes the PNG, then removes the overlay.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { IMAGES_DIR } from "./guide-config";

/**
 * Badge anchor: tl/tr/bl/br = just outside that corner; l/r = outside the left/right edge,
 * vertically centred; ir = inside the right edge (for full-width boxes with short text).
 */
export type BadgePos = "tl" | "tr" | "bl" | "br" | "l" | "r" | "ir";

export interface Callout {
  /** Element to highlight (must be visible). */
  at: Locator;
  /** Number printed in the badge; matches the numbered step in docs/user-guide/index.html. */
  n: number;
  pos?: BadgePos;
  /** Grow the outline box by this many px on every side (default 4). */
  pad?: number;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  n: number;
  pos: BadgePos;
  pad: number;
}

export interface ShotOptions {
  /** File name without extension, e.g. "09-awards-list". */
  name: string;
  callouts?: readonly Callout[];
  /** Viewport height for this shot (width stays); restored afterwards. */
  height?: number;
  fullPage?: boolean;
  /** Crop the PNG to this element (plus `clipPad`). */
  clipTo?: Locator;
  clipPad?: number;
}

const OVERLAY_ID = "guide-overlay";
const BADGE = 24;

/** Document coordinates of the target (scroll offsets included, since the overlay is absolute). */
async function measure(page: Page, c: Callout): Promise<Box> {
  await c.at.first().waitFor({ state: "visible", timeout: 10_000 });
  const box = await c.at.first().boundingBox();
  if (!box) throw new Error(`Callout ${c.n}: element has no bounding box`);
  const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  return {
    x: box.x + scroll.x,
    y: box.y + scroll.y,
    width: box.width,
    height: box.height,
    n: c.n,
    pos: c.pos ?? "tl",
    pad: c.pad ?? 4,
  };
}

function inject(arg: { boxes: Box[]; id: string; size: number }): void {
  const { boxes, id, size } = arg;
  const root = document.createElement("div");
  root.id = id;
  root.style.cssText =
    "position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none";
  for (const b of boxes) {
    const x = b.x - b.pad;
    const y = b.y - b.pad;
    const w = b.width + b.pad * 2;
    const h = b.height + b.pad * 2;
    const frame = document.createElement("div");
    frame.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;
      box-sizing:border-box;border:2.5px solid #e11d2e;border-radius:6px;
      background:rgba(225,29,46,0.07);box-shadow:0 0 0 1px rgba(255,255,255,0.8)`;
    const half = size / 2;
    const mid = y + h / 2;
    const anchors: Record<BadgePos, [number, number]> = {
      tl: [x - 6, y - 6],
      tr: [x + w + 6, y - 6],
      bl: [x - 6, y + h + 6],
      br: [x + w + 6, y + h + 6],
      l: [x - half - 3, mid],
      r: [x + w + half + 3, mid],
      ir: [x + w - half - 6, mid],
    };
    const [cx, cy] = anchors[b.pos];
    const badge = document.createElement("div");
    badge.textContent = String(b.n);
    badge.style.cssText = `position:absolute;left:${cx - half}px;top:${cy - half}px;width:${size}px;
      height:${size}px;border-radius:50%;background:#e11d2e;color:#fff;border:2px solid #fff;
      box-sizing:border-box;font:700 13px/${size - 4}px system-ui,sans-serif;text-align:center;
      box-shadow:0 1px 4px rgba(0,0,0,0.45)`;
    root.append(frame, badge);
  }
  document.body.append(root);
}

/** Shrinks the PNG losslessly when `optipng` is installed; silently skipped otherwise. */
function optimize(file: string): void {
  spawnSync("optipng", ["-quiet", "-o2", file], { stdio: "ignore" });
}

export async function shot(page: Page, opts: ShotOptions): Promise<string> {
  const original = page.viewportSize();
  if (opts.height && original) {
    await page.setViewportSize({ width: original.width, height: opts.height });
  }
  // Let layout settle after a resize / navigation before measuring.
  await page.evaluate(async () => {
    await document.fonts.ready;
    (document.activeElement as HTMLElement | null)?.blur();
  });
  await page.waitForTimeout(250);
  try {
    const boxes: Box[] = [];
    for (const c of opts.callouts ?? []) boxes.push(await measure(page, c));
    await page.evaluate(inject, { boxes, id: OVERLAY_ID, size: BADGE });
    return await capture(page, opts);
  } finally {
    await page.evaluate((id) => document.getElementById(id)?.remove(), OVERLAY_ID);
    if (original) await page.setViewportSize(original);
  }
}

async function capture(page: Page, opts: ShotOptions): Promise<string> {
  const path = join(IMAGES_DIR, `${opts.name}.png`);
  let clip: { x: number; y: number; width: number; height: number } | undefined;
  if (opts.clipTo) {
    const b = await opts.clipTo.boundingBox();
    const pad = opts.clipPad ?? 0;
    if (b) {
      clip = {
        x: Math.max(0, b.x - pad),
        y: Math.max(0, b.y - pad),
        width: b.width + pad * 2,
        height: b.height + pad * 2,
      };
    }
  }
  await page.screenshot({
    path,
    fullPage: opts.fullPage ?? false,
    animations: "disabled",
    caret: "hide",
    ...(clip ? { clip } : {}),
  });
  optimize(path);
  return path;
}
