import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts")) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const { mapTemplateToActionId } = await import(
  new URL("./templateService.ts", import.meta.url)
);

// SPRINT 25.1 — moved verbatim from useCommunicationWorkspace.ts so
// Communication Page and the Workspace Email Panel call the same
// executeAction workflow chain for the same template. These mappings
// must stay exactly what Communication Page already relied on.
test("mapTemplateToActionId: known templates map to their existing actionId", () => {
  assert.equal(
    mapTemplateToActionId("Information Package"),
    "information-package",
  );
  assert.equal(
    mapTemplateToActionId("Quotation"),
    "quotation",
  );
  assert.equal(
    mapTemplateToActionId("Contract"),
    "contract",
  );
  assert.equal(
    mapTemplateToActionId("Revised Quotation"),
    "revised-quotation",
  );
  assert.equal(
    mapTemplateToActionId("Thank You"),
    "thank-you",
  );
});

test("mapTemplateToActionId: Exhibition Presentation reuses information-package (not a distinct actionId)", () => {
  assert.equal(
    mapTemplateToActionId("Exhibition Presentation"),
    "information-package",
  );
});

test("mapTemplateToActionId: Visa/Visitor Invitation both fall back to additional-documents", () => {
  assert.equal(
    mapTemplateToActionId("Visa Invitation"),
    "additional-documents",
  );
  assert.equal(
    mapTemplateToActionId("Visitor Invitation"),
    "additional-documents",
  );
});

test("mapTemplateToActionId: an unrecognized template also falls back to additional-documents", () => {
  assert.equal(
    mapTemplateToActionId("Something Unknown"),
    "additional-documents",
  );
});
