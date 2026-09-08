import assert from "node:assert/strict";
import test from "node:test";

const fairy = await import(new URL("./fairyContext.ts", import.meta.url));
const NOW = new Date("2026-09-09T12:00:00Z");
const row = (id, extra = {}) => ({ id, created_at: "2026-09-08T12:00:00Z", updated_at: "2026-09-08T12:00:00Z", ...extra });
const request = (message = "Bugün neye odaklanmalıyım?", conversation = []) => ({ message, conversation, now: NOW });

// Only a read interface exists. A mutation, RPC or wildcard query makes these
// integration-style context tests fail, without any credentials or live data.
function mockClient(tables = {}, fail = () => null) {
  const calls = [];
  return {
    calls,
    from(table) {
      const call = { table, columns: null, filters: [], orders: [], limit: null };
      const builder = {
        select(columns) {
          assert.ok(columns && !columns.includes("*"));
          call.columns = columns;
          return builder;
        },
        eq(column, value) { call.filters.push(["eq", column, value]); return builder; },
        in(column, value) { call.filters.push(["in", column, value]); return builder; },
        not(column, operator, value) {
          assert.equal(operator, "in");
          call.filters.push(["not", column, value]);
          return builder;
        },
        gte(column, value) { call.filters.push(["gte", column, value]); return builder; },
        lte(column, value) { call.filters.push(["lte", column, value]); return builder; },
        lt(column, value) { call.filters.push(["lt", column, value]); return builder; },
        ilike(column, value) { call.filters.push(["ilike", column, value]); return builder; },
        order(column, options = {}) { call.orders.push([column, options]); return builder; },
        limit(limit) { call.limit = limit; return builder; },
        then(resolve, reject) {
          return Promise.resolve().then(() => {
            calls.push(call);
            assert.ok(call.limit > 0 && call.limit <= 97, "every database query is bounded");
            assert.deepEqual(call.orders.at(-1), ["id", { ascending: true }], "every bounded query has a unique final sort key");
            const failure = fail(call);
            if (failure === "throw") throw new Error("secret internal diagnostics");
            if (failure === "null") return { data: null, error: null };
            if (failure) return { data: null, error: { message: failure } };
            let data = [...(tables[table] ?? [])];
            for (const [kind, column, value] of call.filters) {
              data = data.filter((item) => {
                if (kind === "eq") return item[column] === value;
                if (kind === "in") return value.includes(item[column]);
                if (kind === "not") return !value.slice(1, -1).split(",").includes(item[column]);
                if (["gte", "lte", "lt"].includes(kind)) {
                  if (typeof item[column] !== "string") return false;
                  const actual = Date.parse(item[column]);
                  const expected = Date.parse(value);
                  if (!Number.isFinite(actual) || !Number.isFinite(expected)) throw new Error("Expected a date filter");
                  return kind === "gte" ? actual >= expected : kind === "lte" ? actual <= expected : actual < expected;
                }
                if (kind === "ilike") {
                  assert.match(value, /^%[\p{L}\p{N}][\p{L}\p{N}-]{2,59}%$/u);
                  return String(item[column] ?? "").toLocaleLowerCase("tr-TR").includes(value.slice(1, -1).toLocaleLowerCase("tr-TR"));
                }
                throw new Error(`Unexpected query filter ${kind}`);
              });
            }
            for (const [column, options] of [...call.orders].reverse()) {
              data.sort((a, b) => {
                if (a[column] == null || b[column] == null) {
                  if (a[column] == null && b[column] == null) return 0;
                  return (a[column] == null ? -1 : 1) * (options.nullsFirst ? 1 : -1);
                }
                return String(a[column]).localeCompare(String(b[column])) * (options.ascending === false ? -1 : 1);
              });
            }
            // Preserve extra fields deliberately: the projection must reject
            // them even if a future client/test supplies more than selected.
            return { data: data.slice(0, call.limit), error: null };
          }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

test("projects explicit fields, excludes unrelated metadata and preserves inputs", () => {
  const records = {
    companies: [row("c1", { company_name: "Kuzey", status: "legacy", email: "private@example.test", api_key: "hidden-key", metadata: { secret: "hidden-secret" } })],
    exhibitions: [row("e1", { name: "Expo", start_date: "2026-09-12", end_date: "2026-09-14", oauth_refresh_token: "hidden-oauth" })],
    opportunities: [row("o1", { company_id: "c1", exhibition_id: "e1", stage: "interested", owner: "actor@example.test", estimated_value: 1250, payment_plan: [{ amount: 999 }] })],
    reminders: [row("r1", { company_id: "c1", opportunity_id: "o1", completed: false, title: "Review scope" })],
    timeline_events: [row("t1", { company_id: "c1", opportunity_id: "o1", title: "Call", description: "Budget needs confirmation", metadata: { bearer: "hidden-bearer" } })],
    emails: [row("m1", { company_id: "c1", subject: "Stand details", body: "<p>Please confirm the area.</p>", status: "draft", sent_at: null, to_recipients: ["recipient@example.test"], send_operation_key: "internal-operation" })],
  };
  const original = structuredClone(records);
  const context = fairy.shapeFairyContext({ records, now: NOW });
  const serialized = JSON.stringify(context);
  for (const excluded of ["hidden-key", "hidden-secret", "hidden-oauth", "actor@example.test", "private@example.test", "recipient@example.test", "internal-operation", "payment_plan", "<p>"]) assert.equal(serialized.includes(excluded), false);
  assert.equal(context.companies[0].storedStatus, "legacy");
  assert.equal("status" in context.companies[0], false);
  assert.equal(context.opportunities[0].estimated_value, 1250);
  assert.equal(context.emails[0].status, "draft");
  assert.equal(context.emails[0].sent_at, null);
  assert.equal(context.emails[0].body_excerpt, "Please confirm the area.");
  assert.deepEqual(context.coverage.unresolvedLinks, { companies: 0, exhibitions: 0, opportunities: 0 });
  assert.deepEqual(records, original);
});

test("redacts credential-bearing free text before clipping and across email markup", () => {
  const secrets = [
    "Authorization: Bearer private-token-value", "sk-proj-abcdefghijk123456", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature",
    "refresh_token=private-refresh-value", 'client_secret: "private-client-secret"', "OPENAI_API_KEY=private-api-key",
    "ya29.private-google-access-token", "1//private-google-refresh-token",
  ];
  for (const secret of secrets) {
    assert.match(fairy.sanitizeFairyText(`Operational text ${"x".repeat(800)} ${secret}`, 80), /omitted/);
    assert.match(fairy.fairyEmailExcerpt(`<div>${secret}</div>`), /omitted/);
  }
  assert.match(fairy.fairyEmailExcerpt("<b>Bearer</b> private-token-value"), /omitted/);
  assert.match(fairy.fairyEmailExcerpt("&#66;earer&#32;private-token-value"), /omitted/);
  assert.match(fairy.fairyEmailExcerpt("&amp;#66;earer&amp;#32;private-token-value"), /omitted/);
  assert.equal(fairy.sanitizeFairyText({ secret: "value" }), null);
});

test("suppresses Supabase secrets, Google client secrets and private key fields before clipping or lookup", () => {
  const secrets = [
    "sb_secret_SYNTHETIC_1234567890", "GOCSPX-SYNTHETIC_1234567890",
    ...["", "RSA ", "EC ", "DSA ", "OPENSSH ", "ENCRYPTED "].map((kind) => `-----BEGIN ${kind}PRIVATE KEY-----\nSYNTHETIC_KEY_DATA\n-----END ${kind}PRIVATE KEY-----`),
  ];
  for (const secret of secrets) {
    const field = `Ordinary operational content ${"x".repeat(800)} ${secret}`;
    const encoded = [...secret].map((character) => `&#${character.codePointAt(0)};`).join("");
    for (const result of [fairy.sanitizeFairyText(field, 80), fairy.fairyEmailExcerpt(field), fairy.fairyEmailExcerpt(`<p>${encoded}</p>`), fairy.fairyEmailExcerpt(encoded.replaceAll("&", "&amp;"))]) {
      assert.equal(result, "[Credential-like text omitted]");
    }
    assert.deepEqual(fairy.extractFairyLookupTerms(request(`Acme ${secret}`)), []);
    assert.deepEqual(fairy.extractFairyLookupTerms(request("Bu firma ne durumda?", [{ role: "user", content: `Acme ${secret}` }])), []);
  }
});

test("email excerpts remove markup and quoted history and remain bounded", () => {
  assert.equal(fairy.fairyEmailExcerpt("<style>.x { color:red; }</style><script>private_code()</script><p>New reply &amp; update.</p><blockquote>Old commitment.</blockquote>"), "New reply & update.");
  assert.equal(fairy.fairyEmailExcerpt("The booth is not confirmed.\nOn Monday, Someone wrote:\nIt is confirmed."), "The booth is not confirmed.");
  assert.equal(fairy.fairyEmailExcerpt("New text.\n> Previous text."), "New text.");
  assert.equal(fairy.fairyEmailExcerpt("&lt;script&gt;private_code()&lt;/script&gt;&lt;p&gt;New text.&lt;/p&gt;"), "New text.");
  assert.equal(fairy.fairyEmailExcerpt("a".repeat(3000)).length, 500);
});

test("open reminders on terminal opportunities remain evidence but are not active workload", () => {
  const context = fairy.shapeFairyContext({ now: NOW, records: {
    opportunities: [row("signed", { stage: "signed" }), row("lost", { stage: "lost" }), row("won", { stage: " WON " }), row("active", { stage: "negotiation" })],
    reminders: ["signed", "lost", "won", "active", "missing"].map((id) => row(`r-${id}`, { opportunity_id: id, completed: false, due_date: "2020-01-01" })).concat([
      row("manual", { opportunity_id: null, completed: false }), row("done", { opportunity_id: "active", completed: true }),
    ]),
  } });
  const reminders = new Map(context.reminders.map((item) => [item.id, item]));
  for (const stage of ["signed", "lost", "won"]) assert.equal(reminders.get(`r-${stage}`).isActiveWorkload, false);
  assert.equal(reminders.get("r-active").isActiveWorkload, true);
  assert.equal(reminders.get("r-missing").isActiveWorkload, null);
  assert.equal(reminders.get("manual").isActiveWorkload, true);
  assert.equal(reminders.has("done"), false);
  assert.equal(context.coverage.unresolvedLinks.opportunities, 1);
});

test("uses Istanbul calendar date and chronology rather than string timestamp ordering", () => {
  const context = fairy.shapeFairyContext({ now: new Date("2026-09-09T22:00:00Z"), records: {
    timeline_events: [row("earlier", { created_at: "2026-09-09T14:00:00+03:00" }), row("later", { created_at: "2026-09-09T12:00:00Z" })],
    reminders: [row("no-date", { completed: false, due_date: null }), row("future", { completed: false, due_date: "2026-09-12" }), row("past", { completed: false, due_date: "2026-09-01" })],
    emails: [row("old-send", { sent_at: "2026-08-01T10:00:00Z", created_at: "2026-09-09T00:00:00Z" }), row("new-draft", { sent_at: null, created_at: "2026-09-08T00:00:00Z" })],
  } });
  assert.equal(context.localDate, "2026-09-10");
  assert.equal(context.timezone, "Europe/Istanbul");
  assert.deepEqual(context.timeline_events.map((item) => item.id), ["later", "earlier"]);
  assert.deepEqual(context.reminders.map((item) => item.id), ["past", "future", "no-date"]);
  assert.deepEqual(context.emails.map((item) => item.id), ["new-draft", "old-send"]);
});

test("all six capped projections are deterministic for equal, missing and invalid dates", () => {
  for (const table of ["companies", "exhibitions", "opportunities", "reminders", "timeline_events", "emails"]) {
    for (const date of ["2026-09-10T12:00:00Z", null, "invalid-date"]) {
      const records = Array.from({ length: 40 }, (_, index) => row(`${table}-${String(index).padStart(2, "0")}`, {
        completed: false, due_date: date, start_date: date, end_date: date, sent_at: date, created_at: date, updated_at: date,
      }));
      const forward = fairy.shapeFairyContext({ now: NOW, records: { [table]: records } });
      const reverse = fairy.shapeFairyContext({ now: NOW, records: { [table]: [...records].reverse() } });
      assert.deepEqual(reverse, forward, `${table}: ${date}`);
      assert.ok(forward[table].length < records.length, "the test exercises a real cap");
      assert.equal(forward[table][0].id, `${table}-00`);
    }
  }
});

test("caps the whole serialized context and reports truncated samples without pretending totals", () => {
  const big = "Long operational content ".repeat(150);
  const records = Object.fromEntries(["companies", "exhibitions", "opportunities", "reminders", "timeline_events", "emails"].map((table) => [table, Array.from({ length: 80 }, (_, i) => row(`${table}-${i}`, {
    company_id: `companies-${i}`, exhibition_id: `exhibitions-${i}`, opportunity_id: `opportunities-${i}`,
    company_name: big, name: big, country: big, industry: big, city: big, sector: big, organizer: big,
    stage: "interested", next_action: big, closure_note: big, title: big, description: big, subject: big, body: big, completed: false,
  }))]));
  const context = fairy.shapeFairyContext({ now: NOW, records, queryCapped: { companies: true } });
  assert.ok(JSON.stringify(context).length <= fairy.FAIRY_CONTEXT_MAX_CHARS);
  assert.equal(context.coverage.complete, false);
  assert.equal(context.coverage.tables.companies.queryCapped, true);
  for (const table of Object.keys(records)) {
    assert.ok(context[table].length > 0, `${table} evidence survives the budget`);
    assert.equal(context.coverage.tables[table].rowsRead, 80);
    assert.equal(context.coverage.tables[table].rowsIncluded, context[table].length);
    assert.equal(context.coverage.tables[table].omittedFromRead, 80 - context[table].length);
    assert.equal(context.coverage.tables[table].truncated, true);
  }
});

test("extracts a small safe name lookup from the current and recent user messages only", () => {
  assert.deepEqual(fairy.extractFairyLookupTerms(request()), []);
  assert.deepEqual(fairy.extractFairyLookupTerms(request("Bu firma ne durumda?", [
    { role: "user", content: "Kuzey'nin durumu nedir?" },
    { role: "assistant", content: "InventedSecretCompany" },
  ])), ["Kuzey"]);
  const terms = fairy.extractFairyLookupTerms(request("Acme'),or(id.eq.1)%_ Atlas Demo Fourth Fifth"));
  assert.ok(terms.length <= 4);
  for (const term of terms) assert.match(term, /^[\p{L}\p{N}][\p{L}\p{N}-]{2,59}$/u);
  assert.deepEqual(fairy.extractFairyLookupTerms(request("Authorization: Bearer private-token")), []);
});

function namedFixture() {
  const old = "2024-01-01T00:00:00Z";
  return {
    companies: [row("named-company", { company_name: "Kuzey Mermer", updated_at: old }), ...Array.from({ length: 40 }, (_, i) => row(`recent-${i}`, { company_name: `Recent ${i}` }))],
    exhibitions: [row("named-exhibition", { name: "Atlas", start_date: "2024-01-01", end_date: "2024-01-05" })],
    opportunities: [row("named-opportunity", { company_id: "named-company", exhibition_id: "named-exhibition", stage: "lost", closure_reason: "budget", closure_note: "Participation postponed", updated_at: old }), ...Array.from({ length: 40 }, (_, i) => row(`active-${i}`, { company_id: `recent-${i}`, stage: "new" }))],
    reminders: [row("old-reminder", { company_id: "named-company", opportunity_id: "named-opportunity", completed: false, due_date: "2024-01-02" })],
    timeline_events: [row("old-event", { company_id: "named-company", opportunity_id: "named-opportunity", description: "Customer postponed the decision", created_at: old })],
    emails: [row("old-email", { company_id: "named-company", subject: "Postponed", body: "No participation this year.", status: "draft", sent_at: null, created_at: old })],
  };
}

test("reads bounded explicit columns only and enriches old named companies outside recent samples", async () => {
  const client = mockClient(namedFixture());
  const context = await fairy.loadFairyContext(client, request("Kuzey ne durumda?"));
  assert.equal(context.companies[0].id, "named-company");
  assert.ok(context.exhibitions.some((item) => item.id === "named-exhibition"));
  assert.equal(context.opportunities[0].id, "named-opportunity");
  assert.equal(context.opportunities[0].stage, "lost");
  assert.equal(context.reminders.find((item) => item.id === "old-reminder").isActiveWorkload, false);
  assert.equal(context.timeline_events[0].id, "old-event");
  assert.equal(context.emails[0].id, "old-email");
  assert.equal(context.emails[0].status, "draft");
  assert.equal(context.emails[0].body_excerpt, "No participation this year.");
  assert.equal(context.coverage.tables.companies.queryCapped, true);
  assert.equal(context.coverage.tables.opportunities.queryCapped, true);
  const permitted = new Set(["companies", "exhibitions", "opportunities", "reminders", "timeline_events", "emails"]);
  for (const call of client.calls) {
    assert.ok(permitted.has(call.table));
    assert.doesNotMatch(call.columns, /\*|token|secret|recipients|owner|metadata|created_by/);
    assert.ok(call.limit <= 97);
  }
  assert.ok(client.calls.some((call) => call.table === "opportunities" && call.filters.some(([kind, column, value]) => kind === "not" && column === "stage" && value === "(signed,lost,won)")));
  assert.ok(client.calls.filter((call) => call.table === "reminders").every((call) => call.filters.some(([kind, column, value]) => kind === "eq" && column === "completed" && value === false)));
});

test("capped queries and hydrated context are independent of database row order", async () => {
  const tables = Object.fromEntries(["companies", "exhibitions", "opportunities", "reminders", "timeline_events", "emails"].map((table) => [table, Array.from({ length: 40 }, (_, index) => {
    const suffix = String(index).padStart(2, "0");
    return row(`${table}-${suffix}`, {
      company_id: `companies-${suffix}`, exhibition_id: `exhibitions-${suffix}`, opportunity_id: `opportunities-${suffix}`,
      company_name: "Kuzey", name: "Atlas", stage: "interested", completed: false,
      due_date: "2026-09-10T12:00:00Z", start_date: "2026-09-10", end_date: "2026-09-12", body: "Recent operational update.",
    });
  })]));
  const forward = await fairy.loadFairyContext(mockClient(tables), request("Kuzey Atlas"));
  const permuted = Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, [...rows.slice(17), ...rows.slice(0, 17)].reverse()]));
  const reordered = await fairy.loadFairyContext(mockClient(permuted), request("Kuzey Atlas"));
  assert.deepEqual(reordered, forward);
  for (const table of Object.keys(tables)) {
    assert.ok(forward[table].length > 0, `${table} is exercised`);
    assert.equal(forward.coverage.tables[table].queryCapped, true, `${table} has a capped query`);
  }
});

test("upcoming reminders use complete Istanbul calendar days with an exclusive upper boundary", async () => {
  const client = mockClient({ reminders: [
    ...Array.from({ length: 12 }, (_, index) => row(`old-${index}`, { completed: false, due_date: "2020-01-01T00:00:00Z" })),
    row("before-today", { completed: false, due_date: "2026-09-09T20:59:59.999Z" }),
    row("at-today", { completed: false, due_date: "2026-09-09T21:00:00Z" }),
    row("last-in-window", { completed: false, due_date: "2026-12-09T20:59:59.999Z" }),
    row("after-window", { completed: false, due_date: "2026-12-09T21:00:00Z" }),
  ] });
  const context = await fairy.loadFairyContext(client, { ...request(), now: new Date("2026-09-09T22:00:00Z") });
  const included = context.reminders.map((item) => item.id);
  assert.ok(included.includes("at-today"));
  assert.ok(included.includes("last-in-window"));
  assert.equal(included.includes("before-today"), false);
  assert.equal(included.includes("after-window"), false);
  const windowQuery = client.calls.find((call) => call.table === "reminders" && call.filters.some(([kind]) => kind === "gte"));
  assert.ok(windowQuery.filters.some(([kind, column, value]) => kind === "gte" && column === "due_date" && value === "2026-09-10T00:00:00+03:00"));
  assert.ok(windowQuery.filters.some(([kind, column, value]) => kind === "lt" && column === "due_date" && value === "2026-12-09T21:00:00.000Z"));
});

test("named older exhibitions bring their opportunities, companies and communication together", async () => {
  const context = await fairy.loadFairyContext(mockClient(namedFixture()), request("Atlas hakkında"));
  assert.equal(context.exhibitions[0].id, "named-exhibition");
  assert.equal(context.companies[0].id, "named-company");
  assert.equal(context.opportunities[0].id, "named-opportunity");
  assert.equal(context.timeline_events[0].id, "old-event");
  assert.equal(context.emails[0].id, "old-email");
});

test("follow-up company questions resolve from bounded user history", async () => {
  const context = await fairy.loadFairyContext(mockClient(namedFixture()), request("Bu firma ne durumda?", [{ role: "user", content: "Kuzey hakkında" }, { role: "assistant", content: "OtherEntity" }]));
  assert.deepEqual(context.coverage.namedLookup.terms, ["Kuzey"]);
  assert.equal(context.companies[0].id, "named-company");
});

test("terminal reminder backlogs do not crowd out current and overdue active work", async () => {
  const old = "2020-01-01T00:00:00Z";
  const client = mockClient({
    companies: [row("company", { company_name: "Company" })],
    opportunities: [row("active", { company_id: "company", stage: "negotiation" }), ...Array.from({ length: 40 }, (_, i) => row(`terminal-${i}`, { company_id: "company", stage: "signed", updated_at: old }))],
    reminders: [
      ...Array.from({ length: 40 }, (_, i) => row(`leftover-${i}`, { company_id: "company", opportunity_id: `terminal-${i}`, completed: false, due_date: "2020-01-01" })),
      row("overdue-active", { company_id: "company", opportunity_id: "active", completed: false, due_date: "2026-09-01" }),
      row("upcoming-active", { company_id: "company", opportunity_id: "active", completed: false, due_date: "2026-09-10" }),
      row("upcoming-manual", { company_id: "company", opportunity_id: null, completed: false, due_date: "2026-09-11" }),
    ],
    exhibitions: [row("current", { name: "Current", start_date: "2026-09-08", end_date: "2026-09-11" })],
  });
  const context = await fairy.loadFairyContext(client, request());
  assert.deepEqual(context.reminders.slice(0, 3).map((item) => item.id), ["overdue-active", "upcoming-active", "upcoming-manual"]);
  assert.ok(context.reminders.slice(0, 3).every((item) => item.isActiveWorkload === true));
  assert.ok(context.reminders.some((item) => item.id.startsWith("leftover-") && item.isActiveWorkload === false));
  assert.ok(client.calls.some((call) => call.table === "reminders" && call.filters.some(([kind, column]) => kind === "gte" && column === "due_date")));
});

test("current exhibitions survive a large linked historical sample and named history remains prioritized", () => {
  const exhibitions = [
    ...Array.from({ length: 25 }, (_, i) => row(`old-${i}`, { start_date: "2020-01-01", end_date: "2020-01-02" })),
    row("current", { start_date: "2026-09-08", end_date: "2026-09-11" }),
    row("upcoming", { start_date: "2026-09-20", end_date: null }),
  ];
  const general = fairy.shapeFairyContext({ now: NOW, records: { exhibitions } });
  assert.deepEqual(general.exhibitions.slice(0, 2).map((item) => item.id), ["current", "upcoming"]);
  const focused = fairy.shapeFairyContext({ now: NOW, records: { exhibitions }, lookup: { terms: ["Archive"], companyIds: [], exhibitionIds: ["old-0"], focusedCompanyIds: [] } });
  assert.deepEqual(focused.exhibitions.slice(0, 3).map((item) => item.id), ["old-0", "current", "upcoming"]);
});

test("query errors, transport failures and invalid null results fail closed with safe diagnostics", async () => {
  for (const failure of ["SQL internal secret bearer-value", "throw", "null"]) {
    const client = mockClient({}, (call) => call.table === "emails" ? failure : null);
    await assert.rejects(fairy.loadFairyContext(client, request()), (error) => {
      assert.ok(error instanceof fairy.FairyContextUnavailableError);
      assert.equal(error.message, "VIAWA operational context is unavailable.");
      return true;
    });
  }
});

test("a failed named lookup is not silently presented as an absent company", async () => {
  const client = mockClient(namedFixture(), (call) => call.filters.some(([kind]) => kind === "ilike") ? "lookup failed" : null);
  await assert.rejects(fairy.loadFairyContext(client, request("Kuzey")), fairy.FairyContextUnavailableError);
});
