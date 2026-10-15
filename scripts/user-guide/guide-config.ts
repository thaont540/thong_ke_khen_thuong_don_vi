/** Shared constants of the user-guide screenshot generator (see capture-user-guide-screenshots.ts). */
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

/** Own port and own D1 directory: never collides with `vite dev` (5173), e2e (5180) or `.wrangler/state`. */
export const GUIDE_PORT = 5181;
export const BASE_URL = `http://localhost:${GUIDE_PORT}`;
export const GUIDE_STATE_DIR = resolve(ROOT, ".wrangler/user-guide-state");
export const IMAGES_DIR = resolve(ROOT, "docs/user-guide/images");

export const DESKTOP = { width: 1366, height: 800 } as const;
export const MOBILE = { width: 390, height: 844 } as const;

/** Clearly fake accounts. `mustChange` = forced password change screen (never submitted). */
export const DEMO_PASSWORD = "Demo-Matkhau-2026";
export const DEMO_USERS = [
  { id: 1, username: "quantri.demo", fullName: "Lê Hoàng Quản", role: "ADMIN" },
  { id: 2, username: "bientap.demo", fullName: "Phạm Thu Hà", role: "EDITOR" },
  { id: 3, username: "xem.demo", fullName: "Đỗ Quang Huy", role: "VIEWER" },
  { id: 4, username: "bientap2.demo", fullName: "Vũ Thị Mai", role: "EDITOR" },
  { id: 5, username: "xem2.demo", fullName: "Ngô Đức Thịnh", role: "VIEWER", locked: true },
  { id: 6, username: "nguoimoi.demo", fullName: "Hoàng Văn Nam", role: "EDITOR", mustChange: true },
] as const;

export type DemoUser = (typeof DEMO_USERS)[number];
export const userByName = (username: string): DemoUser => {
  const u = DEMO_USERS.find((d) => d.username === username);
  if (!u) throw new Error(`Unknown demo user ${username}`);
  return u;
};
