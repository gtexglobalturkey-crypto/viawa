import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { transformWithOxc } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const compiled = new Map();
const componentUrl = new URL("./ExhibitionSalesDocuments.tsx", import.meta.url).href;
const testRuntimeUrl = "viawa-test:sales-documents-hooks";
for (const relative of [
  "./ExhibitionSalesDocuments.tsx",
  "../models/ExhibitionSalesDocument.ts",
]) {
  const url = new URL(relative, import.meta.url);
  compiled.set(url.href, (await transformWithOxc(readFileSync(url, "utf8"), url.pathname, { jsx: { runtime: "automatic" } })).code);
}

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === testRuntimeUrl || (context.parentURL === componentUrl && (
      specifier === "react" || specifier === "../services/exhibitionSalesDocumentService"
    ))) {
      return { url: testRuntimeUrl, shortCircuit: true };
    }
    try { return next(specifier, context); }
    catch (error) {
      if (specifier.startsWith(".")) {
        for (const extension of [".ts", ".tsx"]) {
          try { return next(`${specifier}${extension}`, context); } catch {}
        }
      }
      throw error;
    }
  },
  load(url, context, next) {
    if (url === testRuntimeUrl) {
      return {
        format: "module",
        shortCircuit: true,
        source: `
          let driver;
          export function setHookDriver(next) { driver = next; }
          export function useState(...args) { return driver.useState(...args); }
          export function useEffect(...args) { return driver.useEffect(...args); }
          export function loadExhibitionSalesDocuments(...args) { return driver.load(...args); }
        `,
      };
    }
    if (url.endsWith("/services/supabase/client.ts")) {
      return { format: "module", shortCircuit: true, source: "export const supabase = {};" };
    }
    if (compiled.has(url)) return { format: "module", shortCircuit: true, source: compiled.get(url) };
    return next(url, context);
  },
});

const { ExhibitionSalesDocuments, ExhibitionSalesDocumentsView } = await import("./ExhibitionSalesDocuments.tsx");
const { setHookDriver } = await import(testRuntimeUrl);
const documents = [{
  id: "sales-floor-plan",
  exhibitionId: "exhibition-a",
  documentType: "floor_plan",
  title: "WAMPEX 2027 <Floor plan> & information",
  driveFileId: "Abcdef1234_-floorplan",
  sortOrder: 10,
}, {
  id: "sales-flyer",
  exhibitionId: "exhibition-a",
  documentType: "flyer",
  title: "Custom exhibition flyer",
  driveFileId: "Abcdef1234_-flyer",
  sortOrder: 20,
}];

function render(props = {}) {
  return renderToStaticMarkup(React.createElement(ExhibitionSalesDocumentsView, {
    documents,
    loading: false,
    error: null,
    ...props,
  }));
}

test("sales documents render escaped data titles as real Drive view links in new tabs", () => {
  const html = render();
  assert.match(html, /Satış Dokümanları/);
  assert.match(html, /WAMPEX 2027 &lt;Floor plan&gt; &amp; information/);
  assert.match(html, /Custom exhibition flyer/);
  const anchors = html.match(/<a\b[^>]*>/g) ?? [];
  assert.equal(anchors.length, 2);
  for (const [index, anchor] of anchors.entries()) {
    assert.ok(anchor.includes(`href="https://drive.google.com/file/d/${documents[index].driveFileId}/view"`));
    assert.match(anchor, /target="_blank"/);
    assert.match(anchor, /rel="noopener noreferrer"/);
    assert.doesNotMatch(anchor, /\bdownload(?:=|\s|>)/);
  }
  assert.doesNotMatch(html, /<iframe\b|<embed\b|<object\b/);
});

test("unsafe stored file references do not render actionable anchors", () => {
  for (const driveFileId of ["javascript:alert(1)", "https://example.com/foreign-file", "short", "Abcdef1234/view"]) {
    const html = render({ documents: [{ ...documents[0], driveFileId }] });
    assert.doesNotMatch(html, /<a\b|href=/);
  }
});

test("loading state is visible and hides documents from a prior result", () => {
  const html = render({ loading: true });
  assert.match(html, /yükleniyor/i);
  assert.doesNotMatch(html, /<a\b|Custom exhibition flyer/);
});

test("failed loading is visible and hides documents from a prior result", () => {
  const html = render({ error: "Satış dokümanları yüklenemedi." });
  assert.match(html, /yüklenemedi/i);
  assert.doesNotMatch(html, /<a\b|Custom exhibition flyer/);
});

test("empty exhibition state explains that no sales documents are present", () => {
  const html = render({ documents: [] });
  assert.match(html, /Satış Dokümanları/);
  assert.match(html, /henüz|bulunmuyor|eklenmedi|yok/i);
  assert.doesNotMatch(html, /<a\b|href=/);
});

function createHookDriver() {
  const states = [];
  const effects = [];
  const pendingEffects = [];
  const requests = [];
  let stateCursor = 0;
  let effectCursor = 0;
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
      if (!previous || dependencies.some((value, position) => !Object.is(value, previous.dependencies[position]))) {
        pendingEffects.push(() => {
          previous?.cleanup?.();
          effects[index] = { dependencies: [...dependencies], cleanup: callback() };
        });
      }
    },
    load(client, exhibitionId) {
      let resolve;
      let reject;
      const promise = new Promise((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
      requests.push({ exhibitionId, resolve, reject });
      return promise;
    },
    render(exhibitionId) {
      stateCursor = 0;
      effectCursor = 0;
      setHookDriver(driver);
      return renderToStaticMarkup(ExhibitionSalesDocuments({ exhibitionId }));
    },
    flushEffects() {
      for (const effect of pendingEffects.splice(0)) effect();
    },
    cleanup() {
      for (const effect of effects) effect?.cleanup?.();
    },
    requests,
  };
  return driver;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

test("switching exhibitions immediately hides old links and ignores stale success and error responses", async () => {
  const driver = createHookDriver();
  try {
    assert.match(driver.render("exhibition-a"), /yükleniyor/i);
    driver.flushEffects();
    driver.requests[0].resolve(documents);
    await flushPromises();
    assert.match(driver.render("exhibition-a"), /Custom exhibition flyer/);

    // React renders new props before running the next effect.
    const switching = driver.render("exhibition-b");
    assert.match(switching, /yükleniyor/i);
    assert.doesNotMatch(switching, /<a\b|Custom exhibition flyer/);
    driver.flushEffects();
    driver.render("exhibition-c");
    driver.flushEffects();
    assert.deepEqual(driver.requests.map((request) => request.exhibitionId), ["exhibition-a", "exhibition-b", "exhibition-c"]);

    const latest = [{ ...documents[0], exhibitionId: "exhibition-c", title: "Current exhibition C" }];
    driver.requests[2].resolve(latest);
    await flushPromises();
    assert.match(driver.render("exhibition-c"), /Current exhibition C/);
    driver.requests[1].resolve([{ ...documents[1], exhibitionId: "exhibition-b", title: "Late exhibition B" }]);
    await flushPromises();
    const afterStaleSuccess = driver.render("exhibition-c");
    assert.match(afterStaleSuccess, /Current exhibition C/);
    assert.doesNotMatch(afterStaleSuccess, /Late exhibition B/);

    driver.render("exhibition-d");
    driver.flushEffects();
    driver.render("exhibition-e");
    driver.flushEffects();
    driver.requests[4].resolve([{ ...documents[1], exhibitionId: "exhibition-e", title: "Current exhibition E" }]);
    await flushPromises();
    driver.requests[3].reject(new Error("Late request failed"));
    await flushPromises();
    const afterStaleFailure = driver.render("exhibition-e");
    assert.match(afterStaleFailure, /Current exhibition E/);
    assert.doesNotMatch(afterStaleFailure, /yüklenemedi|Late request failed|Current exhibition C/);
  } finally {
    driver.cleanup();
  }
});
