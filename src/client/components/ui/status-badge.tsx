import type { ReactNode } from "react";

export type BadgeTone = "ok" | "err" | "warn" | "muted" | "dh" | "kt";

const TONE_CLASS: Record<BadgeTone, string> = {
  ok: "pill-ok",
  err: "pill-err",
  warn: "pill-warn",
  muted: "pill-cn",
  dh: "pill-dh",
  kt: "pill-kt",
};

export function StatusBadge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <span className={`pill ${TONE_CLASS[tone]}`}>{children}</span>;
}
