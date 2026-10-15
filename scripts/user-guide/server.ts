/** Builds the app and serves it with `vite preview` on the guide port (same recipe as e2e). */
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { BASE_URL, GUIDE_PORT, GUIDE_STATE_DIR } from "./guide-config";

const ENV = { ...process.env, E2E_STATE_DIR: GUIDE_STATE_DIR };

export function buildApp(): void {
  const run = spawnSync("npx", ["vite", "build"], { stdio: "inherit", env: ENV });
  if (run.status !== 0) throw new Error("vite build failed");
}

async function healthy(): Promise<boolean> {
  try {
    return (await fetch(`${BASE_URL}/api/health`)).ok;
  } catch {
    return false;
  }
}

export interface RunningServer {
  stop: () => void;
}

export async function startPreview(): Promise<RunningServer> {
  if (await healthy()) {
    throw new Error(`Port ${GUIDE_PORT} is already in use; stop the other process first.`);
  }
  // detached => own process group, so the whole npx/vite/workerd tree can be signalled at once.
  const child: ChildProcess = spawn(
    "npx",
    ["vite", "preview", "--port", String(GUIDE_PORT), "--strictPort"],
    { env: ENV, stdio: "ignore", detached: true },
  );
  let exited = false;
  child.once("exit", () => {
    exited = true;
  });
  const stop = () => {
    if (child.pid && !exited) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        // already gone
      }
    }
  };
  process.once("exit", stop);
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.once(sig, () => {
      stop();
      process.exit(1);
    });
  }
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (exited) throw new Error("vite preview exited before becoming healthy");
    if (await healthy()) return { stop };
    await new Promise((r) => setTimeout(r, 500));
  }
  stop();
  throw new Error("vite preview did not become healthy within 120 s");
}
