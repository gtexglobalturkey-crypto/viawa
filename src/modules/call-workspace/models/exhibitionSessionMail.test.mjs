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

const {
  buildContractMailtoUrl,
  buildWorkspaceEmailAttachments,
  createEmptyWorkspaceEmailDraft,
  createWorkspaceEmailSendOperationKey,
  filterRepositoryDocumentsForSession,
  findLatestContractDocument,
  formatWorkspaceEmailEventSummary,
  normalizeWorkspaceEmail,
  resolveContractAttachmentForSession,
  resolveQuotationPriceSource,
  unlinkedMailEvents,
  validateWorkspaceEmailRecipients,
  withMailEventAppended,
  withMailEventsLinked,
} = await import(new URL("./exhibitionSessionMail.ts", import.meta.url));

const { withSessionDraft, getSessionDraft } = await import(
  new URL("./exhibitionSessionDraft.ts", import.meta.url)
);

function event(overrides = {}) {
  return {
    id: "op-1",
    sendOperationKey: "op-1",
    recordedAt: "2026-08-01T10:00:00.000Z",
    to: ["contact@example.com"],
    cc: [],
    bcc: [],
    subject: "Konu",
    templateId: "Information Package",
    attachments: [],
    quotationSummaryIncluded: false,
    contractIncluded: false,
    emailRecordId: "email-1",
    deliveryMode: "viawa-record",
    status: "sent",
    timelineLinkedAt: null,
    ...overrides,
  };
}

test("createEmptyWorkspaceEmailDraft: starts with no recipients/attachments and the given template", () => {
  const draft = createEmptyWorkspaceEmailDraft("Quotation");

  assert.deepEqual(draft.to, []);
  assert.deepEqual(draft.cc, []);
  assert.deepEqual(draft.bcc, []);
  assert.equal(draft.templateId, "Quotation");
  assert.deepEqual(draft.attachments, []);
  assert.equal(draft.quotationSummaryIncluded, false);
  assert.equal(typeof draft.sendOperationKey, "string");
  assert.ok(draft.sendOperationKey.length > 0);
});

test("createEmptyWorkspaceEmailDraft: two fresh drafts never share a sendOperationKey", () => {
  const a = createEmptyWorkspaceEmailDraft("Information Package");
  const b = createEmptyWorkspaceEmailDraft("Information Package");

  assert.notEqual(a.sendOperationKey, b.sendOperationKey);
});

test("normalizeWorkspaceEmail: trims and lowercases", () => {
  assert.equal(
    normalizeWorkspaceEmail("  Contact@Example.com "),
    "contact@example.com",
  );
});

test("validateWorkspaceEmailRecipients: no TO recipients is rejected", () => {
  const result = validateWorkspaceEmailRecipients({
    to: [],
    cc: ["cc@example.com"],
    bcc: [],
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /TO alıcısı/);
});

test("validateWorkspaceEmailRecipients: an invalid address is rejected", () => {
  const result = validateWorkspaceEmailRecipients({
    to: ["not-an-email"],
    cc: [],
    bcc: [],
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /geçersiz/);
});

test("validateWorkspaceEmailRecipients: the same address in two fields is rejected", () => {
  const result = validateWorkspaceEmailRecipients({
    to: ["a@example.com"],
    cc: ["a@example.com"],
    bcc: [],
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /birden fazla/);
});

test("validateWorkspaceEmailRecipients: a well-formed, non-duplicated set passes", () => {
  const result = validateWorkspaceEmailRecipients({
    to: ["a@example.com"],
    cc: ["b@example.com"],
    bcc: ["c@example.com"],
  });

  assert.equal(result.ok, true);
});

test("createWorkspaceEmailSendOperationKey: produces distinct keys", () => {
  const first = createWorkspaceEmailSendOperationKey();
  const second = createWorkspaceEmailSendOperationKey();

  assert.notEqual(first, second);
  assert.equal(typeof first, "string");
  assert.ok(first.length > 0);
});

test("filterRepositoryDocumentsForSession: keeps only the locked fuar's documents", () => {
  const documents = [
    { exhibitionId: "ex-1", role: "kroki" },
    { exhibitionId: "ex-2", role: "brosur" },
    { exhibitionId: "ex-1", role: "fuar_takvimi" },
  ];

  const filtered = filterRepositoryDocumentsForSession(
    documents,
    "ex-1",
  );

  assert.equal(filtered.length, 2);
  assert.ok(filtered.every((doc) => doc.exhibitionId === "ex-1"));
});

function repositoryDocument(overrides = {}) {
  return {
    exhibitionId: "ex-1",
    exhibitionName: "VIAWA Fuarı",
    role: "kroki",
    displayName: "Kroki",
    fileName: "Kroki.pdf",
    resolvedUrl: "/api/document-basket/file?role=kroki&exhibitionName=VIAWA",
    mimeType: "application/pdf",
    exists: true,
    source: "document-basket",
    ...overrides,
  };
}

// Sprint 25.4E — the ONE attachment source for Workspace Email. No
// template placeholders, no Document Basket, no synthesized names: an
// attachment exists here if and only if it was explicitly checked off in
// the Exhibition Repository panel.
test("buildWorkspaceEmailAttachments: no explicit repository selection -> empty list", () => {
  assert.deepEqual(buildWorkspaceEmailAttachments([]), []);
});

test("buildWorkspaceEmailAttachments: one explicit selection -> exactly one attachment with real metadata, no placeholder name", () => {
  const result = buildWorkspaceEmailAttachments([
    repositoryDocument({ fileName: "Broşür.pdf", role: "brosur" }),
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].fileName, "Broşür.pdf");
  assert.equal(result[0].source, "exhibition-workspace");
  assert.equal(result[0].exhibitionId, "ex-1");
  assert.equal(result[0].exhibitionRole, "brosur");
  assert.equal(
    result[0].fileUrl,
    "/api/document-basket/file?role=kroki&exhibitionName=VIAWA",
  );
  assert.equal(result[0].mimeType, "application/pdf");
});

test("buildWorkspaceEmailAttachments: two explicit selections -> exactly two attachments, in order", () => {
  const result = buildWorkspaceEmailAttachments([
    repositoryDocument({ fileName: "Broşür.pdf", role: "brosur" }),
    repositoryDocument({ fileName: "Kroki.pdf", role: "kroki" }),
  ]);

  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((attachment) => attachment.fileName),
    ["Broşür.pdf", "Kroki.pdf"],
  );
});

test("buildWorkspaceEmailAttachments: never invents a fileName beyond what the repository selection carried", () => {
  const result = buildWorkspaceEmailAttachments([
    repositoryDocument({ fileName: "Gerçek Dosya Adı 2026.pdf" }),
  ]);

  assert.equal(result[0].fileName, "Gerçek Dosya Adı 2026.pdf");
});

function generatedDocument(overrides = {}) {
  return {
    id: "doc-1",
    documentType: "participation-contract",
    contractNumber: "EXP-2026-000001",
    version: 1,
    companyId: "company-1",
    exhibitionId: "ex-1",
    opportunityId: "opp-1",
    approvedSnapshotId: "snap-1",
    fileName: "Sozlesme.pdf",
    status: "pdf-generated",
    createdAt: "2026-08-01T10:00:00.000Z",
    ...overrides,
  };
}

// BUG-S26-002 — Test 1: sözleşme yok -> ek gelmemeli.
test("resolveContractAttachmentForSession: no matching contract -> null", () => {
  const result = resolveContractAttachmentForSession(
    [],
    "ex-1",
    "opp-1",
  );

  assert.equal(result, null);
});

// BUG-S26-002 — Test 2: sözleşme var -> gerçek PDF otomatik eklenmeli.
test("resolveContractAttachmentForSession: matching contract -> real attachment, not a placeholder", () => {
  const result = resolveContractAttachmentForSession(
    [generatedDocument({ fileName: "Katilim-Sozlesmesi.pdf" })],
    "ex-1",
    "opp-1",
  );

  assert.notEqual(result, null);
  assert.equal(result.fileName, "Katilim-Sozlesmesi.pdf");
  assert.equal(result.source, "generated-contract");
  assert.equal(result.exhibitionId, "ex-1");
});

// BUG-S26-002 — Test 4: başka fuarın sözleşmesi eklenmemeli.
test("resolveContractAttachmentForSession: a contract for a different exhibition never matches", () => {
  const result = resolveContractAttachmentForSession(
    [generatedDocument({ exhibitionId: "ex-2" })],
    "ex-1",
    "opp-1",
  );

  assert.equal(result, null);
});

test("resolveContractAttachmentForSession: a contract for a different opportunity never matches", () => {
  const result = resolveContractAttachmentForSession(
    [generatedDocument({ opportunityId: "opp-2" })],
    "ex-1",
    "opp-1",
  );

  assert.equal(result, null);
});

test("resolveContractAttachmentForSession: without a real opportunity, nothing auto-attaches", () => {
  const result = resolveContractAttachmentForSession(
    [generatedDocument()],
    "ex-1",
    null,
  );

  assert.equal(result, null);
});

// BUG-S26-002 — Test 5: en güncel sözleşme seçilmeli.
test("resolveContractAttachmentForSession: picks the highest version among matches, never an older one", () => {
  const result = resolveContractAttachmentForSession(
    [
      generatedDocument({
        id: "doc-old",
        version: 1,
        fileName: "v1.pdf",
        createdAt: "2026-07-01T10:00:00.000Z",
      }),
      generatedDocument({
        id: "doc-new",
        version: 2,
        fileName: "v2.pdf",
        createdAt: "2026-08-01T10:00:00.000Z",
      }),
    ],
    "ex-1",
    "opp-1",
  );

  assert.equal(result.fileName, "v2.pdf");
  assert.equal(result.id, "generated-contract:doc-new");
});

test("resolveContractAttachmentForSession: prefers a signed PDF's own filename/data URL when available", () => {
  const result = resolveContractAttachmentForSession(
    [
      generatedDocument({
        status: "signed",
        signedPdfFileName: "Imzali-Sozlesme.pdf",
        signedPdfDataUrl: "data:application/pdf;base64,AAAA",
      }),
    ],
    "ex-1",
    "opp-1",
  );

  assert.equal(result.fileName, "Imzali-Sozlesme.pdf");
  assert.equal(result.fileUrl, "data:application/pdf;base64,AAAA");
});

// BUG-S26-002.1 — before signing, the attachment must still carry a real,
// openable fileUrl (falls back to the freshly generated PDF's own data
// URL) instead of being left undefined until the contract is signed.
test("resolveContractAttachmentForSession: falls back to pdfDataUrl when not yet signed", () => {
  const result = resolveContractAttachmentForSession(
    [
      generatedDocument({
        status: "pdf-generated",
        pdfDataUrl: "data:application/pdf;base64,BBBB",
      }),
    ],
    "ex-1",
    "opp-1",
  );

  assert.equal(result.fileUrl, "data:application/pdf;base64,BBBB");
});

// SPRINT 26.2 — findLatestContractDocument is the shared "which
// contract" answer behind both the attachment builder and the Dropbox
// Sign trigger; these mirror the equivalent resolveContractAttachmentForSession
// cases above to prove the extraction didn't change behavior.
test("findLatestContractDocument: no matching contract -> null", () => {
  assert.equal(
    findLatestContractDocument([], "ex-1", "opp-1"),
    null,
  );
});

test("findLatestContractDocument: returns the real record, not a wrapper", () => {
  const document = generatedDocument({ fileName: "Sozlesme-v1.pdf" });
  const result = findLatestContractDocument(
    [document],
    "ex-1",
    "opp-1",
  );

  assert.equal(result, document);
});

test("findLatestContractDocument: picks the highest version among matches", () => {
  const older = generatedDocument({ id: "doc-old", version: 1 });
  const newer = generatedDocument({ id: "doc-new", version: 2 });

  const result = findLatestContractDocument(
    [older, newer],
    "ex-1",
    "opp-1",
  );

  assert.equal(result.id, "doc-new");
});

test("findLatestContractDocument: without a real opportunity, nothing matches", () => {
  assert.equal(
    findLatestContractDocument(
      [generatedDocument()],
      "ex-1",
      null,
    ),
    null,
  );
});

test("resolveQuotationPriceSource: draft price wins over an approved opportunity price", () => {
  const source = resolveQuotationPriceSource({
    draftPriceResult: {
      result: {
        currency: "EUR",
        grandTotal: 5000,
        appliedInput: {
          standType: "shell-scheme",
          standAreaSqm: 12,
        },
      },
    },
    approvedOpportunityPrice: {
      standType: "space-only",
      standAreaSqm: 20,
      currency: "USD",
      grandTotal: 9999,
    },
  });

  assert.deepEqual(source, {
    standType: "shell-scheme",
    standAreaSqm: 12,
    currency: "EUR",
    grandTotal: 5000,
  });
});

test("resolveQuotationPriceSource: falls back to the approved opportunity price when there is no draft price", () => {
  const approved = {
    standType: "space-only",
    standAreaSqm: 20,
    currency: "USD",
    grandTotal: 9999,
  };

  const source = resolveQuotationPriceSource({
    draftPriceResult: null,
    approvedOpportunityPrice: approved,
  });

  assert.deepEqual(source, approved);
});

test("resolveQuotationPriceSource: null when neither exists — caller must block, not crash", () => {
  const source = resolveQuotationPriceSource({
    draftPriceResult: null,
    approvedOpportunityPrice: null,
  });

  assert.equal(source, null);
});

test("buildWorkspaceEmailAttachments: a recorded event's attachments snapshot is unaffected by a later repository selection change", () => {
  const atSendTime = buildWorkspaceEmailAttachments([
    repositoryDocument({ fileName: "Broşür.pdf", role: "brosur" }),
  ]);

  let store = withMailEventAppended(
    {},
    "ex-1",
    event({ attachments: atSendTime }),
  );

  // The user un-checks Broşür and checks Kroki instead, after the send.
  const laterLiveAttachments = buildWorkspaceEmailAttachments([
    repositoryDocument({ fileName: "Kroki.pdf", role: "kroki" }),
  ]);

  assert.deepEqual(
    getSessionDraft(store, "ex-1").mailEvents[0].attachments,
    atSendTime,
  );
  assert.notDeepEqual(laterLiveAttachments, atSendTime);
});

test("withMailEventAppended: adds the event to the targeted fuar's session only", () => {
  let store = withSessionDraft({}, "ex-1", { note: "hello" });
  store = withMailEventAppended(store, "ex-1", event());

  assert.equal(getSessionDraft(store, "ex-1").mailEvents.length, 1);
  assert.equal(getSessionDraft(store, "ex-2").mailEvents.length, 0);
});

test("withMailEventAppended: a duplicate sendOperationKey is not appended twice", () => {
  let store = withMailEventAppended({}, "ex-1", event());
  store = withMailEventAppended(
    store,
    "ex-1",
    event({ recordedAt: "2026-08-01T10:05:00.000Z" }),
  );

  assert.equal(getSessionDraft(store, "ex-1").mailEvents.length, 1);
});

test("withMailEventAppended: two different sends both land in mailEvents[]", () => {
  let store = withMailEventAppended({}, "ex-1", event({ id: "op-1", sendOperationKey: "op-1" }));
  store = withMailEventAppended(store, "ex-1", event({ id: "op-2", sendOperationKey: "op-2" }));

  assert.equal(getSessionDraft(store, "ex-1").mailEvents.length, 2);
});

test("unlinkedMailEvents: only events without timelineLinkedAt", () => {
  const events = [
    event({ id: "a", timelineLinkedAt: null }),
    event({ id: "b", timelineLinkedAt: "2026-08-01T11:00:00.000Z" }),
  ];

  const result = unlinkedMailEvents(events);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "a");
});

test("withMailEventsLinked: marks only the given ids, only for the targeted fuar", () => {
  let store = withMailEventAppended({}, "ex-1", event({ id: "a", sendOperationKey: "a" }));
  store = withMailEventAppended(store, "ex-1", event({ id: "b", sendOperationKey: "b" }));
  store = withMailEventAppended(store, "ex-2", event({ id: "c", sendOperationKey: "c" }));

  store = withMailEventsLinked(
    store,
    "ex-1",
    ["a"],
    "2026-08-01T12:00:00.000Z",
  );

  const ex1Events = getSessionDraft(store, "ex-1").mailEvents;
  assert.equal(
    ex1Events.find((e) => e.id === "a").timelineLinkedAt,
    "2026-08-01T12:00:00.000Z",
  );
  assert.equal(
    ex1Events.find((e) => e.id === "b").timelineLinkedAt,
    null,
  );

  // ex-2's event is untouched by an ex-1 commit.
  assert.equal(
    getSessionDraft(store, "ex-2").mailEvents[0].timelineLinkedAt,
    null,
  );
});

test("withMailEventsLinked: never re-marks an already-linked event (idempotent)", () => {
  let store = withMailEventAppended(
    {},
    "ex-1",
    event({ id: "a", sendOperationKey: "a", timelineLinkedAt: "2026-08-01T09:00:00.000Z" }),
  );

  store = withMailEventsLinked(store, "ex-1", ["a"], "2026-08-01T12:00:00.000Z");

  assert.equal(
    getSessionDraft(store, "ex-1").mailEvents[0].timelineLinkedAt,
    "2026-08-01T09:00:00.000Z",
  );
});

test("formatWorkspaceEmailEventSummary: includes recipients, subject and attachments", () => {
  const summary = formatWorkspaceEmailEventSummary(
    event({
      to: ["a@example.com"],
      cc: ["b@example.com"],
      subject: "Fuar Bilgi Paketi",
      attachments: [{ id: "1", fileName: "Kroki.pdf", source: "template" }],
    }),
  );

  assert.match(summary, /a@example\.com/);
  assert.match(summary, /b@example\.com/);
  assert.match(summary, /Fuar Bilgi Paketi/);
  assert.match(summary, /Kroki\.pdf/);
});

test("formatWorkspaceEmailEventSummary: mentions quotation/contract only when included", () => {
  const withExtras = formatWorkspaceEmailEventSummary(
    event({ quotationSummaryIncluded: true, contractIncluded: true }),
  );
  const withoutExtras = formatWorkspaceEmailEventSummary(event());

  assert.match(withExtras, /Teklif özeti eklendi/);
  assert.match(withExtras, /Sözleşme eklendi/);
  assert.doesNotMatch(withoutExtras, /Teklif özeti eklendi/);
  assert.doesNotMatch(withoutExtras, /Sözleşme eklendi/);
});

// Sprint 25.2 / Adım 2 → 2.1 — Contract's "Outlook'ta Aç" replacement
// for "Gönder": a pure mailto: builder from the existing draft, nothing
// regenerated. The primary recipient goes in the RFC 6068 address
// segment (mailto:addr?...), not a "to=" query param.
test("buildContractMailtoUrl: single recipient sits in the mailto: address segment, not a to= query param", () => {
  const url = buildContractMailtoUrl({
    to: ["contact@example.com"],
    cc: [],
    bcc: [],
    subject: "Katılım Sözleşmesi",
    body: "Sayın Yetkili,\n\nSözleşme ektedir.",
  });

  assert.equal(
    url.startsWith("mailto:contact@example.com?"),
    true,
  );
  assert.doesNotMatch(url, /[?&]to=/);

  const [, query] = url.split("?");
  const params = new URLSearchParams(query);

  assert.equal(
    params.get("subject"),
    "Katılım Sözleşmesi",
  );
  assert.equal(
    params.get("body"),
    "Sayın Yetkili,\n\nSözleşme ektedir.",
  );
  assert.equal(params.has("cc"), false);
  assert.equal(params.has("bcc"), false);
});

test("buildContractMailtoUrl: multiple to recipients stay comma-joined in the address segment; cc/bcc stay in the query string", () => {
  const url = buildContractMailtoUrl({
    to: ["a@example.com", "b@example.com"],
    cc: ["c@example.com"],
    bcc: ["d@example.com"],
    subject: "Konu",
    body: "Gövde",
  });

  assert.equal(
    url.startsWith(
      "mailto:a@example.com,b@example.com?",
    ),
    true,
  );
  assert.doesNotMatch(url, /[?&]to=/);

  const [, query] = url.split("?");
  const params = new URLSearchParams(query);

  assert.equal(
    params.get("cc"),
    "c@example.com",
  );
  assert.equal(
    params.get("bcc"),
    "d@example.com",
  );
});

test("buildContractMailtoUrl: no recipient at all -> mailto:?... , never a broken/undefined address segment", () => {
  const url = buildContractMailtoUrl({
    to: [],
    cc: [],
    bcc: [],
    subject: "Test",
    body: "Hello",
  });

  assert.equal(
    url.startsWith("mailto:?"),
    true,
  );
  assert.doesNotMatch(url, /[?&]to=/);

  const [, query] = url.split("?");
  const params = new URLSearchParams(query);

  assert.equal(params.get("subject"), "Test");
  assert.equal(params.get("body"), "Hello");
});

test("buildContractMailtoUrl: Turkish characters and newlines in subject/body are safely encoded (round-trip via URLSearchParams)", () => {
  const url = buildContractMailtoUrl({
    to: [],
    cc: [],
    bcc: [],
    subject: "Fuar & Sözleşme?",
    body: "Satır 1\nSatır 2 <özel> karakterler",
  });

  const [, query] = url.split("?");
  const params = new URLSearchParams(query);

  assert.equal(
    params.get("subject"),
    "Fuar & Sözleşme?",
  );
  assert.equal(
    params.get("body"),
    "Satır 1\nSatır 2 <özel> karakterler",
  );
});

test("buildContractMailtoUrl: the address segment never double-encodes a plain address (no literal %25 in the output)", () => {
  const url = buildContractMailtoUrl({
    to: ["contact@example.com"],
    cc: [],
    bcc: [],
    subject: "Test",
    body: "Hello",
  });

  const [addressSegment] = url
    .slice("mailto:".length)
    .split("?");

  assert.equal(
    addressSegment,
    "contact@example.com",
  );
  assert.doesNotMatch(addressSegment, /%25/);
});

// Sprint 25.2.2 — real Outlook test showed the subject/body rendering
// with literal "+" instead of spaces (URLSearchParams.toString() uses
// application/x-www-form-urlencoded, which RFC 6068 mailto hfields do
// not speak — Outlook decodes %20, not "+"). These assert the raw URL
// string itself (not a re-parsed/decoded value), which is the only way
// to actually catch this class of bug.
test("buildContractMailtoUrl: a multi-word subject uses %20 for spaces in the raw URL, never a literal +", () => {
  const url = buildContractMailtoUrl({
    to: ["contact@example.com"],
    cc: [],
    bcc: [],
    subject: "Mining Türkiye 2026 Katılım Sözleşmesi",
    body: "Hello",
  });

  assert.doesNotMatch(url, /\+/);
  assert.match(
    url,
    /subject=Mining%20T%C3%BCrkiye%202026%20Kat%C4%B1l%C4%B1m%20S%C3%B6zle%C5%9Fmesi/,
  );
});

test("buildContractMailtoUrl: a multi-word body uses %20 for spaces in the raw URL, never a literal +", () => {
  const url = buildContractMailtoUrl({
    to: ["contact@example.com"],
    cc: [],
    bcc: [],
    subject: "Test",
    body: "Sayın Expovia Uluslararası Fuarcılık ekibi",
  });

  assert.doesNotMatch(url, /\+/);
  assert.match(url, /body=Say%C4%B1n%20Expovia/);
});

test("buildContractMailtoUrl: the subject is never prefixed with a literal \"name:\" or any other stray field name", () => {
  const url = buildContractMailtoUrl({
    to: ["contact@example.com"],
    cc: ["cc@example.com"],
    bcc: [],
    subject: "Mining Türkiye 2026 Katılım Sözleşmesi",
    body: "Sayın Expovia Uluslararası Fuarcılık ekibi",
  });

  assert.doesNotMatch(url, /name[:=]/i);

  const [, query] = url.split("?");
  const params = new URLSearchParams(query);

  assert.equal(
    params.get("subject"),
    "Mining Türkiye 2026 Katılım Sözleşmesi",
  );
});

test("buildContractMailtoUrl: subject and body hfields come before cc/bcc, for maximum real-world mail client compatibility", () => {
  const url = buildContractMailtoUrl({
    to: ["contact@example.com"],
    cc: ["cc@example.com"],
    bcc: ["bcc@example.com"],
    subject: "Test",
    body: "Hello",
  });

  const [, query] = url.split("?");
  const fieldNames = query
    .split("&")
    .map((field) => field.split("=")[0]);

  assert.deepEqual(fieldNames, [
    "subject",
    "body",
    "cc",
    "bcc",
  ]);
});
