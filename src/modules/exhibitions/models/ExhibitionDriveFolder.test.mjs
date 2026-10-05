import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { transformWithOxc } from "vite";

const here = (relative) => new URL(relative, import.meta.url);

async function importCompiled(relative) {
  const url = here(relative);
  const { code } = await transformWithOxc(readFileSync(url, "utf8"), url.pathname);
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}

const {
  getDriveFolderUrl,
  normalizeDriveFolderId,
  parseDriveFolderInput,
} = await importCompiled("./ExhibitionDriveFolder.ts");

const FOLDER_ID = "10u3GdBQjg0FBJyB81FUtUVFhaQJmQ6Ko";

test("the folder URL is derived from the stored id", () => {
  assert.equal(getDriveFolderUrl(FOLDER_ID), `https://drive.google.com/drive/folders/${FOLDER_ID}`);
  assert.equal(getDriveFolderUrl(`  ${FOLDER_ID} `), `https://drive.google.com/drive/folders/${FOLDER_ID}`);
});

test("an unbound or unsafe id never becomes a URL", () => {
  for (const value of [null, undefined, "", "   ", "javascript:alert(1)", "abc/def", "abc?x=1", "a b", 42]) {
    assert.equal(getDriveFolderUrl(value), null);
    assert.equal(normalizeDriveFolderId(value), null);
  }
});

test("user input accepts a bare id or a Drive folder link only", () => {
  assert.equal(parseDriveFolderInput(FOLDER_ID), FOLDER_ID);
  assert.equal(parseDriveFolderInput(` ${FOLDER_ID} `), FOLDER_ID);
  assert.equal(parseDriveFolderInput(`https://drive.google.com/drive/folders/${FOLDER_ID}`), FOLDER_ID);
  assert.equal(parseDriveFolderInput(`https://drive.google.com/drive/u/0/folders/${FOLDER_ID}?usp=sharing`), FOLDER_ID);

  for (const value of [
    "",
    "short",
    "CONTECH Vietnam 2027",
    `http://drive.google.com/drive/folders/${FOLDER_ID}`,
    `https://evil.example/drive/folders/${FOLDER_ID}`,
    `https://drive.google.com/file/d/${FOLDER_ID}/view`,
    "https://drive.google.com/drive/folders/",
    "https://drive.google.com/drive/my-drive",
  ]) {
    assert.equal(parseDriveFolderInput(value), null, value);
  }
});

test("the folder id stays out of exhibition_sales_documents and no URL is stored", () => {
  const model = readFileSync(here("./ExhibitionDriveFolder.ts"), "utf8");
  const sidebar = readFileSync(here("../components/ExhibitionSidebarSection.tsx"), "utf8");
  const modal = readFileSync(here("../components/ExhibitionCreateModal.tsx"), "utf8");
  const migration = readFileSync(
    here("../../../../supabase/migrations/20261005120000_add_exhibition_drive_folder_id.sql"),
    "utf8",
  );

  for (const source of [model, sidebar, modal, migration]) {
    assert.doesNotMatch(source, /exhibition_sales_documents|drive_folder_url|driveFolderUrl/);
  }
  assert.doesNotMatch(migration, /\b(drop|delete|update|truncate)\b/i);
  assert.match(migration, /add column if not exists drive_folder_id text;/);
  assert.match(migration, /\^\[A-Za-z0-9_-\]\+\$/);
  assert.match(migration, /where drive_folder_id is not null/);
});

test("creation binds an existing folder without duplicating it or touching a reused record", () => {
  const sidebar = readFileSync(here("../components/ExhibitionSidebarSection.tsx"), "utf8");
  const modal = readFileSync(here("../components/ExhibitionCreateModal.tsx"), "utf8");

  assert.match(modal, /parseDriveFolderInput\(/);
  assert.match(modal, /errors\.driveFolder/);
  assert.match(sidebar, /candidate\.drive_folder_id ===\s*requestedFolderId/);
  assert.match(sidebar, /folderOwner\.id !== existingMatch\?\.id[\s\S]*?return false;/);
  assert.match(sidebar, /\.\.\.\(requestedFolderId\s*\?\s*\{\s*drive_folder_id:\s*requestedFolderId,/);
  assert.doesNotMatch(sidebar, /updateExhibition|deleteExhibition/);
});
