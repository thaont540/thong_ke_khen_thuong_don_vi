import { Hono } from "hono";
import { ERROR_CODE } from "../shared/schemas/api-common-schemas";
import { handleError } from "./lib/error-handler";
import { apiSecurityHeaders, authBodyLimit } from "./middleware/api-hardening-middleware";
import { apiOrDocumentBodyLimit } from "./middleware/document-upload-guard";
import { loginRateLimit } from "./middleware/login-rate-limit-middleware";
import { mustChangePasswordGate } from "./middleware/must-change-password-gate";
import { originCheck } from "./middleware/origin-check-middleware";
import { sessionAuth } from "./middleware/session-auth-middleware";
import { authRoutes, meRoutes } from "./routes/auth-routes";
import { awardsImportRoutes } from "./routes/awards-import-routes";
import { awardsRoutes } from "./routes/awards-routes";
import { documentsRoutes } from "./routes/documents-routes";
import { masterDataRoutes } from "./routes/master-data-routes";
import { officerLookupRoutes } from "./routes/officer-lookup-routes";
import { officersAdminRoutes } from "./routes/officers-admin-routes";
import { unitsRoutes } from "./routes/units-routes";
import { usersRoutes } from "./routes/users-routes";
import type { AppEnv } from "./types/hono-env";

export const app = new Hono<AppEnv>();

// Order matters: headers -> origin check -> body limits (before any parsing) -> session ->
// must-change gate -> per-router requireRole.
app.use("/api/*", apiSecurityHeaders);
app.use("/api/*", originCheck);
app.use("/api/*", apiOrDocumentBodyLimit); // 256 KB, or 20 MB on document uploads
app.post("/api/auth/login", loginRateLimit);
app.use("/api/auth/*", authBodyLimit);
app.use("/api/*", sessionAuth);
app.use("/api/*", mustChangePasswordGate);

app.get("/api/health", (c) => c.json({ ok: true }));

// Mount table is fixed (phase 02); later phases only fill the router files.
app.route("/api/auth", authRoutes); // login, logout, change-password (03)
app.route("/api/me", meRoutes); // GET / -> current user (03)
app.route("/api/master", masterDataRoutes);
app.route("/api/users", usersRoutes);
app.route("/api/units", unitsRoutes);
app.route("/api/officers", officerLookupRoutes); // /options, GET /:id (06) FIRST
app.route("/api/officers", officersAdminRoutes); // list/create/update/delete (05)
app.route("/api/awards/import", awardsImportRoutes); // before /api/awards (07)
app.route("/api/awards", awardsRoutes);
app.route("/api/documents", documentsRoutes);

app.all("/api/*", (c) =>
  c.json({ error: { code: ERROR_CODE.NOT_FOUND, message: "Not found" } }, 404),
);

app.onError(handleError);
