/**
 * Generates docs/user-guide/images/*.png: builds the app, serves it on an isolated port with an
 * isolated D1 seeded with fake demo data, then drives the real UI with Playwright and draws numbered
 * callouts. Run: `npm run docs:user-guide` (see docs/user-guide/index.html, section "Cập nhật tài liệu").
 */
import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { chromium } from "@playwright/test";
import {
  captureForcedPasswordChange,
  captureLogin,
  captureRoleMenus,
  captureUserMenu,
} from "./flows-auth";
import {
  captureCollectiveForm,
  captureDuplicateWarning,
  captureMedalForm,
  capturePersonalForm,
  captureRatingForm,
  captureValidationErrors,
} from "./flows-awards-form";
import {
  captureAwardsFiltered,
  captureAwardsList,
  captureDeleteConfirm,
  captureEditAward,
  captureOfficerModal,
  captureRatingFilter,
} from "./flows-awards-list";
import {
  captureDocumentDelete,
  captureDocumentForm,
  captureDocuments,
  captureDocumentsViewer,
  seedDemoDocuments,
} from "./flows-documents";
import { captureImport } from "./flows-import";
import { captureMobile } from "./flows-mobile";
import { captureOfficerDelete, captureOfficerForm, captureOfficers } from "./flows-officers";
import { captureUnits } from "./flows-units";
import { captureUsers } from "./flows-users";
import { GUIDE_PORT, IMAGES_DIR } from "./guide-config";
import { loggedInPage } from "./guide-session";
import { prepareDemoDatabase } from "./seed-demo-data";
import { buildApp, startPreview } from "./server";

async function main(): Promise<void> {
  console.log("[guide] seeding isolated database");
  await prepareDemoDatabase();
  console.log("[guide] building app");
  buildApp();
  rmSync(IMAGES_DIR, { recursive: true, force: true });
  mkdirSync(IMAGES_DIR, { recursive: true });
  console.log(`[guide] starting preview on :${GUIDE_PORT}`);
  const server = await startPreview();
  const browser = await chromium.launch();
  try {
    await captureLogin(browser);
    await captureForcedPasswordChange(browser);
    const admin = await loggedInPage(browser, "quantri.demo");
    const editor = await loggedInPage(browser, "bientap.demo");
    const viewer = await loggedInPage(browser, "xem.demo");
    await captureRoleMenus({ admin, editor, viewer });
    await captureUserMenu(admin);
    await captureAwardsList(admin);
    await captureAwardsFiltered(admin);
    await captureRatingFilter(admin);
    await captureOfficerModal(admin);
    await capturePersonalForm(editor);
    await captureCollectiveForm(editor);
    await captureMedalForm(editor);
    await captureRatingForm(editor);
    await captureValidationErrors(editor);
    await captureEditAward(editor);
    await captureDeleteConfirm(editor);
    await captureDuplicateWarning(editor);
    await captureImport(editor);
    await captureOfficers(admin);
    await captureOfficerForm(admin);
    await captureOfficerDelete(admin);
    await captureUnits(admin);
    await seedDemoDocuments(admin);
    await captureDocuments(admin);
    await captureDocumentForm(admin);
    await captureDocumentDelete(admin);
    await captureDocumentsViewer(browser);
    await captureUsers(admin);
    await captureMobile(browser);
  } finally {
    await browser.close();
    server.stop();
  }
  console.log(`[guide] done -> ${dirname(IMAGES_DIR)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
