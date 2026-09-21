import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { transformWithOxc } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const here = (relative) => new URL(relative, import.meta.url);
const workspaceUrl = here("./ExhibitionWorkspace.tsx").href;
const hooksRuntime = "viawa-test:workspace-hooks";
const salesHookRuntime = "viawa-test:sales-documents-hook";

// The real workspace, tiles, preview, API client and models are compiled as-is.
// Only React's stateful hooks and the Supabase-backed sales-document hook are driven by the test.
const realModules = [
  "./ExhibitionWorkspace.tsx",
  "./ExhibitionDocumentCard.tsx",
  "./ExhibitionDocumentPreview.tsx",
  "../services/exhibitionDocumentApi.ts",
  "../models/ExhibitionDocument.ts",
  "../models/ExhibitionSalesDocument.ts",
  "../utils/resolveMimeType.ts",
  "../../../components/ui/Panel.tsx",
];
const compiled = new Map();
for (const relative of realModules) {
  const url = here(relative);
  compiled.set(url.href, (await transformWithOxc(readFileSync(url, "utf8"), url.pathname, { jsx: { runtime: "automatic" } })).code);
}

registerHooks({
  resolve(specifier, context, next) {
    const parent = context.parentURL;
    if (parent && compiled.has(parent)) {
      if (specifier === "react") return { url: hooksRuntime, shortCircuit: true };
      if (parent === workspaceUrl && specifier === "./ExhibitionSalesDocuments") {
        return { url: salesHookRuntime, shortCircuit: true };
      }
    }
    try { return next(specifier, context); }
    catch (error) {
      if (specifier.startsWith(".") && parent && compiled.has(parent)) {
        for (const extension of [".ts", ".tsx"]) {
          try { return next(`${specifier}${extension}`, context); } catch {}
        }
      }
      throw error;
    }
  },
  load(url, context, next) {
    if (url === hooksRuntime) {
      return {
        format: "module",
        shortCircuit: true,
        source: `
          let driver;
          export function setHookDriver(next) { driver = next; }
          export function useState(...a) { return driver.useState(...a); }
          export function useEffect(...a) { return driver.useEffect(...a); }
          export function useMemo(...a) { return driver.useMemo(...a); }
        `,
      };
    }
    if (url === salesHookRuntime) {
      return {
        format: "module",
        shortCircuit: true,
        source: `
          let value = { documents: [], loading: false, error: null };
          export function setSalesDocuments(next) { value = next; }
          export function useExhibitionSalesDocuments() { return value; }
        `,
      };
    }
    if (compiled.has(url)) return { format: "module", shortCircuit: true, source: compiled.get(url) };
    return next(url, context);
  },
});

const { ExhibitionWorkspace } = await import(workspaceUrl);
const { setHookDriver } = await import(hooksRuntime);
const { setSalesDocuments } = await import(salesHookRuntime);

const FLYER_ID = "1yicvyw_2rYmfHWdmZDSM9U3GtdzI144B";
const KROKI_ID = "1HKKcamBz0liRiWfpkH4DWvR7lECGi-4c";
const exhibition = {
  id: "12205880-6527-4bc5-b9e0-7cad893ee4e3",
  name: "WAMPEX 2027",
  shortName: "WAMPEX 2027",
  city: "Istanbul",
  country: "Türkiye",
};
const kroki = {
  id: "97e116ce-a7a6-49b1-9caa-2483f7032eb7",
  exhibitionId: exhibition.id,
  documentType: "floor_plan",
  title: "WAMPEX 2027 - 14.09.2026.pdf",
  driveFileId: KROKI_ID,
  sortOrder: 20,
};
const flyer = {
  id: "021ecf3b-4553-4ce6-bfd5-c7723f99c3b0",
  exhibitionId: exhibition.id,
  documentType: "flyer",
  title: "WAMPEX 2027 Türkiye Flyer - VIAFA.pdf",
  driveFileId: FLYER_ID,
  sortOrder: 10,
};
const TITLES = ["Fuar Takvimi", "Flyer", "Fiyat Listesi", "Kroki", "Sözleşme"];
const NOT_FOUND = "Belge bulunamadı";

function createDriver() {
  const states = [];
  const effects = [];
  const memos = [];
  const pending = [];
  let stateCursor = 0;
  let effectCursor = 0;
  let memoCursor = 0;
  const changed = (a, b) => !b || a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]));
  const driver = {
    useState(initial) {
      const index = stateCursor++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], (value) => {
        states[index] = typeof value === "function" ? value(states[index]) : value;
      }];
    },
    useEffect(callback, dependencies) {
      const index = effectCursor++;
      const previous = effects[index];
      if (!dependencies || changed(dependencies, previous?.dependencies)) {
        pending.push(() => {
          previous?.cleanup?.();
          effects[index] = { dependencies: dependencies && [...dependencies], cleanup: callback() };
        });
      }
    },
    useMemo(factory, dependencies) {
      const index = memoCursor++;
      if (changed(dependencies, memos[index]?.dependencies)) {
        memos[index] = { dependencies: [...dependencies], value: factory() };
      }
      return memos[index].value;
    },
    render(props) {
      stateCursor = 0;
      effectCursor = 0;
      memoCursor = 0;
      setHookDriver(driver);
      return renderToStaticMarkup(React.createElement(ExhibitionWorkspace, props));
    },
    flush() {
      for (const effect of pending.splice(0)) effect();
    },
    cleanup() {
      for (const effect of effects) effect?.cleanup?.();
    },
  };
  return driver;
}

async function settle() {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

const realFetch = globalThis.fetch;
test.afterEach(() => {
  globalThis.fetch = realFetch;
  setSalesDocuments({ documents: [], loading: false, error: null });
});

const productionSpaFallback = async () => new Response(
  '<!doctype html>\n<html lang="en"><head><title>VIAWA</title></head><body></body></html>',
  { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
);

async function mount({ fetchImpl, sales }) {
  globalThis.fetch = fetchImpl;
  setSalesDocuments(sales);
  const driver = createDriver();
  driver.render({ exhibition });
  driver.flush();
  await settle();
  return { driver, html: driver.render({ exhibition }) };
}

function tile(html, title) {
  const starts = [...html.matchAll(/<(?:a|div) [^>]*class="exhibition-doc-card[ "]/g)].map((m) => m.index);
  const startIndex = starts.find((start) => html.slice(start, start + 900).includes(`exhibition-doc-card-title">${title}<`));
  assert.notEqual(startIndex, undefined, `tile ${title} rendered`);
  const next = starts.find((start) => start > startIndex);
  return html.slice(startIndex, next ?? html.indexOf("exhibition-workspace-footer"));
}

test("production: Flyer and Kroki resolve persisted Drive references inside the existing strip", async () => {
  const { driver, html } = await mount({
    fetchImpl: productionSpaFallback,
    sales: { documents: [flyer, kroki], loading: false, error: null },
  });
  try {
    // existing strip: same five tiles, same order
    const order = [...html.matchAll(/exhibition-doc-card-title">([^<]+)</g)].map((m) => m[1]);
    assert.deepEqual(order, TITLES);

    // no duplicate section, no HTML-as-JSON error, no alert at all
    assert.doesNotMatch(html, /Satış Dokümanları|exhibition-sales-documents/);
    assert.doesNotMatch(html, /Unexpected token|doctype|is not valid JSON|role="alert"/i);

    // Flyer -> flyer record, Kroki -> floor_plan record, exact Drive ids, safe new tab
    for (const [title, id] of [["Flyer", FLYER_ID], ["Kroki", KROKI_ID]]) {
      const markup = tile(html, title);
      assert.match(markup, /^<a /, `${title} tile is a link`);
      assert.ok(markup.includes(`href="https://drive.google.com/file/d/${id}/view"`), `${title} opens its Drive file`);
      assert.match(markup, /target="_blank"/);
      assert.match(markup, /rel="noopener noreferrer"/);
      assert.doesNotMatch(markup, new RegExp(NOT_FOUND));
      assert.doesNotMatch(markup, /exhibition-doc-card-disabled|aria-disabled="true"/);
    }
    assert.equal((html.match(/<a\b/g) ?? []).length, 2);

    // the other three keep their existing "no local document" behaviour
    for (const title of ["Fuar Takvimi", "Fiyat Listesi", "Sözleşme"]) {
      const markup = tile(html, title);
      assert.match(markup, /^<div /);
      assert.match(markup, new RegExp(NOT_FOUND));
      assert.match(markup, /exhibition-doc-card-disabled/);
      assert.match(markup, /aria-disabled="true"/);
      assert.match(markup, /type="checkbox"[^>]*disabled/);
    }
    assert.equal((html.match(new RegExp(NOT_FOUND, "g")) ?? []).length, 3);
    assert.match(html, /Henüz belge seçilmedi\./);
  } finally {
    driver.cleanup();
  }
});

test("Flyer and Kroki are looked up by document type, independent of sort order or extra documents", async () => {
  const { driver, html } = await mount({
    fetchImpl: productionSpaFallback,
    sales: {
      documents: [
        { ...kroki, id: "k", sortOrder: 1 },
        { ...flyer, id: "b", documentType: "brochure", driveFileId: "Brochure12345_-x", sortOrder: 2 },
        { ...flyer, id: "f", sortOrder: 3 },
      ],
      loading: false,
      error: null,
    },
  });
  try {
    assert.ok(tile(html, "Flyer").includes(`/file/d/${FLYER_ID}/view`));
    assert.ok(tile(html, "Kroki").includes(`/file/d/${KROKI_ID}/view`));
    assert.doesNotMatch(html, /Brochure12345/);
  } finally {
    driver.cleanup();
  }
});

test("a missing Drive record keeps that tile in its existing not-found state", async () => {
  const { driver, html } = await mount({
    fetchImpl: productionSpaFallback,
    sales: { documents: [flyer], loading: false, error: null },
  });
  try {
    assert.match(tile(html, "Flyer"), /^<a /);
    assert.match(tile(html, "Kroki"), new RegExp(NOT_FOUND));
    assert.match(tile(html, "Kroki"), /aria-disabled="true"/);
  } finally {
    driver.cleanup();
  }
});

test("an unsafe stored Drive id never becomes a link", async () => {
  const { driver, html } = await mount({
    fetchImpl: productionSpaFallback,
    sales: { documents: [{ ...flyer, driveFileId: "javascript:alert(1)" }], loading: false, error: null },
  });
  try {
    assert.doesNotMatch(html, /<a\b|javascript:/);
    assert.match(tile(html, "Flyer"), new RegExp(NOT_FOUND));
  } finally {
    driver.cleanup();
  }
});

test("real local-document failures are still shown, and Drive tiles stay available", async () => {
  const { driver, html } = await mount({
    fetchImpl: async () => new Response("boom", { status: 500, headers: { "Content-Type": "text/plain" } }),
    sales: { documents: [flyer, kroki], loading: false, error: null },
  });
  try {
    assert.match(html, /role="alert"[^>]*>Fuar belgeleri durumu alınamadı\./);
    assert.ok(tile(html, "Flyer").includes(FLYER_ID));
    assert.ok(tile(html, "Kroki").includes(KROKI_ID));
  } finally {
    driver.cleanup();
  }
});

test("a failed sales-document load is visible and leaves Flyer/Kroki in their existing state", async () => {
  const { driver, html } = await mount({
    fetchImpl: productionSpaFallback,
    sales: { documents: [], loading: false, error: "Satış dokümanları yüklenemedi." },
  });
  try {
    assert.match(html, /role="alert"[^>]*>Satış dokümanları yüklenemedi\./);
    assert.match(tile(html, "Flyer"), new RegExp(NOT_FOUND));
    assert.match(tile(html, "Kroki"), new RegExp(NOT_FOUND));
  } finally {
    driver.cleanup();
  }
});

test("with a local document service, non-Drive tiles keep preview/checkbox behaviour and Drive tiles are links", async () => {
  const items = ["fuar_takvimi", "flyer", "fiyat_listesi", "kroki", "sozlesme"].map((id) => ({
    id, title: id, exists: true, fileName: `${id}.pdf`,
  }));
  const { driver, html } = await mount({
    fetchImpl: async () => new Response(JSON.stringify({ items }), { status: 200, headers: { "Content-Type": "application/json" } }),
    sales: { documents: [flyer, kroki], loading: false, error: null },
  });
  try {
    for (const title of ["Fuar Takvimi", "Fiyat Listesi", "Sözleşme"]) {
      const markup = tile(html, title);
      assert.match(markup, /role="button"/);
      assert.match(markup, /tabindex="0"/);
      assert.doesNotMatch(markup, /aria-disabled="true"|\sdisabled=|exhibition-doc-card-disabled/);
      assert.doesNotMatch(markup, new RegExp(NOT_FOUND));
    }
    for (const title of ["Flyer", "Kroki"]) {
      const markup = tile(html, title);
      assert.match(markup, /^<a /);
      assert.doesNotMatch(markup, /type="checkbox"/);
    }
  } finally {
    driver.cleanup();
  }
});

test("without any Drive record the Flyer/Kroki tiles keep their local-file behaviour", async () => {
  const items = [{ id: "flyer", title: "Flyer", exists: true, fileName: "flyer.pdf" }];
  const { driver, html } = await mount({
    fetchImpl: async () => new Response(JSON.stringify({ items }), { status: 200, headers: { "Content-Type": "application/json" } }),
    sales: { documents: [], loading: false, error: null },
  });
  try {
    assert.match(tile(html, "Flyer"), /role="button"/);
    assert.match(tile(html, "Flyer"), /type="checkbox"/);
    assert.match(tile(html, "Kroki"), new RegExp(NOT_FOUND));
  } finally {
    driver.cleanup();
  }
});

test("the working-screen sources contain no duplicate sales block and no hardcoded Drive ids", () => {
  const sources = [
    "./ExhibitionWorkspace.tsx",
    "./ExhibitionDocumentCard.tsx",
    "../models/ExhibitionDocument.ts",
    "../services/exhibitionDocumentApi.ts",
  ].map((relative) => readFileSync(here(relative), "utf8"));
  for (const source of sources) {
    assert.doesNotMatch(source, /Satış Dokümanları|<ExhibitionSalesDocuments\b/);
    assert.doesNotMatch(source, new RegExp(`${FLYER_ID}|${KROKI_ID}|drive\\.google\\.com`));
  }
});
