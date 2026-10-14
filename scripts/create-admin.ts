/**
 * Creates (or fails on duplicate) an ADMIN account with a one-time temp password.
 *   npm run create-admin -- --username admin --name "Quản trị viên" [--env local|staging|prod]
 * The password is generated here, hashed with the Worker's own lib, written via a temp SQL file
 * (never on the command line / shell history) that is deleted afterwards, and printed once.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { usernameSchema } from "../src/shared/schemas/user-schemas";
import { hashPassword } from "../src/worker/lib/password-hash";
import { generateTempPassword } from "../src/worker/lib/temp-password";

const TARGETS = {
  local: ["--local"],
  staging: ["--env", "staging", "--remote"],
  prod: ["--remote"],
} as const;
type Target = keyof typeof TARGETS;

const sqlString = (v: string) => `'${v.replaceAll("'", "''")}'`;

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      username: { type: "string" },
      name: { type: "string" },
      env: { type: "string", default: "local" },
    },
  });
  const target = values.env as Target;
  if (!(target in TARGETS)) throw new Error("--env must be local, staging or prod");
  const username = usernameSchema.parse(values.username);
  const fullName = values.name?.trim();
  if (!fullName) throw new Error('--name "<full name>" is required');

  const tempPassword = generateTempPassword();
  const hash = await hashPassword(tempPassword);
  const sql =
    `INSERT INTO users (username, full_name, role, password_hash, must_change_password) ` +
    `VALUES (${sqlString(username)}, ${sqlString(fullName)}, 'ADMIN', ${sqlString(hash)}, 1);\n` +
    `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail) ` +
    `VALUES (NULL, 'CREATE', 'user', last_insert_rowid(), ${sqlString(
      JSON.stringify({ username, role: "ADMIN", via: "create-admin script" }),
    )});\n`;

  const dir = mkdtempSync(join(tmpdir(), "create-admin-"));
  const file = join(dir, "create-admin.sql");
  try {
    writeFileSync(file, sql, { mode: 0o600 });
    const run = spawnSync(
      "npx",
      ["wrangler", "d1", "execute", "DB", ...TARGETS[target], "--file", file],
      { stdio: ["ignore", "inherit", "inherit"] },
    );
    if (run.status !== 0) {
      console.error("wrangler failed; no account was reported as created.");
      return run.status ?? 1;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(
    `\nAdmin created on ${target}.\n  username: ${username}\n  temp password (shown once): ${tempPassword}\nThe user must change it at first login.`,
  );
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
