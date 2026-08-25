import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { pathToFileURL } from "node:url";

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

const orchestratorUrl = pathToFileURL(
  `${process.cwd()}/src/modules/document-engine/orchestration/generateParticipationContract.ts`,
).href;
const fileNameUrl = pathToFileURL(
  `${process.cwd()}/src/modules/document-engine/orchestration/contractDocxFileName.ts`,
).href;
const { generateParticipationContract } = await import(orchestratorUrl);
const { createContractDocxFileName } = await import(fileNameUrl);

const now = new Date("2026-07-31T11:30:12.000Z");

function fixtures() {
  const timestamp = now.toISOString();
  const company = {
    id: "company-1",
    company_name: "ABC Mining",
    contact_person: null,
    email: "company@example.com",
    phone: "+90 500 000 00 00",
    website: null,
    country: "Türkiye",
    industry: "Madencilik",
    tax_office: "Çorlu",
    tax_number: "1234567890",
    address: "Çorlu / Tekirdağ",
    city: "Tekirdağ",
    status: "active",
    created_at: timestamp,
    updated_at: timestamp,
  };
  const opportunity = {
    id: "opportunity-1",
    company_id: company.id,
    exhibition_id: "exhibition-1",
    stage: "contract",
    interest_level: 5,
    estimated_value: 10000,
    next_action: null,
    next_action_date: null,
    owner: null,
    price_stand_area_sqm: 12,
    created_at: timestamp,
    updated_at: timestamp,
    // RC-02 — matches priceSnapshot.priceResult.grandTotal (9810) below
    // so the default fixture passes the payment-plan-total-equality
    // check on its own, without every unrelated test needing to know
    // about it.
    payment_plan: [
      { dueDate: null, amount: 9810, payee: null },
      null,
      null,
      null,
      null,
    ],
  };
  const exhibition = {
    id: "exhibition-1",
    name: "WAMPEX 2027",
    city: "Accra",
    country: "Gana",
    sector: "Madencilik",
    organizer: "WAMPEX",
    start_date: "2027-05-24",
    end_date: "2027-05-27",
    created_at: timestamp,
    updated_at: timestamp,
  };
  const contacts = [
    {
      id: "primary",
      company_id: company.id,
      first_name: "Ayşe",
      last_name: "Yılmaz",
      title: "Fuar Yetkilisi",
      phone: "+90 500 000 00 01",
      email: "ayse@example.com",
      is_primary: true,
      is_signatory: false,
      created_at: timestamp,
      updated_at: timestamp,
    },
    {
      id: "signatory",
      company_id: company.id,
      first_name: "Mehmet",
      last_name: "Demir",
      title: "Genel Müdür",
      phone: "+90 500 000 00 02",
      email: "mehmet@example.com",
      is_primary: false,
      is_signatory: true,
      created_at: timestamp,
      updated_at: timestamp,
    },
  ];
  const priceInput = {
    exhibitionId: exhibition.id,
    standType: "custom-stand",
    standLocationType: "corner",
    standAreaSqm: 12,
    basePricePerSqm: 600,
    currency: "USD",
  };
  const priceSnapshot = {
    opportunityId: opportunity.id,
    exhibitionId: exhibition.id,
    exhibitionName: exhibition.name,
    pricingSource: "exhibition-config",
    approvedAt: timestamp,
    priceInput,
    priceResult: {
      currency: "USD",
      sqmAmount: 7200,
      locationSurcharge: 0,
      participationFee: 7200,
      registrationFee: 500,
      serviceFee: 750,
      additionalServicesFee: 0,
      subtotal: 8450,
      discountAmount: 0,
      vatAmount: 1360,
      grandTotal: 9810,
      appliedInput: priceInput,
    },
  };
  const settings = {
    issuer: {
      address: "Çorlu / Tekirdağ",
      mersisNumber: "123",
      tradeRegistryNumber: "456",
      taxOffice: "Çorlu",
      taxNumber: "789",
      website: "www.expovia.com",
      representativeNameTitle: "Yetkili Temsilci",
    },
    bank: {
      bankName: "İş Bankası",
      branchAddress: "Çorlu",
      ibanEur: "TR00 EUR",
      ibanUsd: "TR00 USD",
    },
  };

  return {
    company,
    opportunity,
    exhibition,
    contacts,
    priceSnapshot,
    settings,
  };
}

function dependencies(overrides = {}) {
  const data = fixtures();
  const calls = [];
  const dataSource = {
    loadCompany: async () => {
      calls.push("company");
      return data.company;
    },
    loadOpportunity: async () => {
      calls.push("opportunity");
      return data.opportunity;
    },
    loadExhibition: async () => {
      calls.push("exhibition");
      return data.exhibition;
    },
    loadContacts: async () => {
      calls.push("contacts");
      return data.contacts;
    },
    loadPriceSnapshot: async () => {
      calls.push("price");
      return data.priceSnapshot;
    },
    loadSettings: async () => {
      calls.push("settings");
      return data.settings;
    },
    resolveContractNumber: async () => ({ id: "11111111-1111-4111-8111-111111111111", number: "EXP-2027-000001" }),
    ...overrides,
  };
  let generatorInput;

  return {
    calls,
    getGeneratorInput: () => generatorInput,
    value: {
      dataSource,
      docxGenerator: {
        generate: async (input) => {
          generatorInput = input;
          return {
            outputFileName: input.preferredFileName,
            outputPath: `C:/generated/${input.preferredFileName}`,
            warnings: [],
          };
        },
      },
      now: () => now,
    },
  };
}

test("loads sources in order and generates a structured success result", async () => {
  const setup = dependencies();
  const result = await generateParticipationContract(
    { companyId: "company-1", opportunityId: "opportunity-1" },
    setup.value,
  );

  assert.equal(result.success, true);
  assert.deepEqual(setup.calls, [
    "company",
    "opportunity",
    "exhibition",
    "contacts",
    "price",
    "settings",
  ]);
  assert.equal(result.companyId, "company-1");
  assert.equal(result.opportunityId, "opportunity-1");
  assert.equal(result.exhibitionId, "exhibition-1");
  assert.equal(setup.getGeneratorInput().mergeResult.values["Company.LegalName"], "ABC Mining");
  assert.equal(setup.getGeneratorInput().mergeResult.values["Pricing.GrandTotal.Amount"], 9810);
});

// Sprint 25.8 — Stand Malzemeleri veri giriş alanı: a real selection
// (with quantity), an explicitly-unselected material, an untouched
// material (never in the saved record at all), and a 3-line extra note
// all reach the merge result under the exact tags the master template
// already expects.
test("stand materials selections/quantities and the extra-information note reach the merge result", async () => {
  const setup = dependencies({
    loadOpportunity: async () => ({
      id: "opportunity-1",
      company_id: "company-1",
      exhibition_id: "exhibition-1",
      stage: "contract",
      interest_level: 5,
      estimated_value: 10000,
      next_action: null,
      next_action_date: null,
      owner: null,
      price_stand_area_sqm: 12,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      stand_materials: {
        Table: { selected: true, quantity: 3 },
        Chair: { selected: false, quantity: 4 },
      },
      extra_information: [
        "Ekstra masa lazım",
        "Elektrik bağlantısı organizatör tarafından sağlanır.",
      ],
      // RC-02 — matches the default priceSnapshot's grandTotal (9810)
      // so this test (about stand materials, not payment plan totals)
      // still passes the payment-plan-total-equality check.
      payment_plan: [
        { dueDate: null, amount: 9810, payee: null },
        null,
        null,
        null,
        null,
      ],
    }),
  });

  await generateParticipationContract(
    { companyId: "company-1", opportunityId: "opportunity-1" },
    setup.value,
  );

  const values = setup.getGeneratorInput().mergeResult.values;

  assert.equal(values["StandMaterials.Table.Selected"], true);
  assert.equal(values["StandMaterials.Table.Quantity"], 3);

  assert.equal(values["StandMaterials.Chair.Selected"], false);
  assert.equal(
    values["StandMaterials.Chair.Quantity"],
    4,
    "an unselected material's saved quantity still passes through (the checkbox alone controls what's checked)",
  );

  // Never touched in the saved record at all -> the mapping's own
  // default (false / undefined), never a crash or a stray value.
  assert.equal(values["StandMaterials.Shelf.Selected"], false);
  assert.equal(values["StandMaterials.Shelf.Quantity"], undefined);

  assert.equal(
    values["ExtraInformation.Line1"],
    "Ekstra masa lazım",
  );
  assert.equal(
    values["ExtraInformation.Line2"],
    "Elektrik bağlantısı organizatör tarafından sağlanır.",
  );
  assert.equal(values["ExtraInformation.Line3"], undefined);
});

// An opportunity with no stand_materials/extra_information at all (the
// pre-Sprint-25.8 default for every existing row) must never crash the
// merge or produce a literal "undefined"/placeholder value.
test("no stand materials or extra information saved yet resolves to all-unselected and no note, without crashing", async () => {
  const setup = dependencies();

  await generateParticipationContract(
    { companyId: "company-1", opportunityId: "opportunity-1" },
    setup.value,
  );

  const values = setup.getGeneratorInput().mergeResult.values;

  assert.equal(values["StandMaterials.Table.Selected"], false);
  assert.equal(values["StandMaterials.Table.Quantity"], undefined);
  assert.equal(values["ExtraInformation.Line1"], undefined);
});

// Sprint 25.8 / Adım 2 — Ödeme Planı veri giriş alanı: a plan with only
// the first row filled, a blank row (index 2) left null, and a fully
// filled last row all reach the merge result under the exact
// PaymentPlan.PaymentN.* tags the master template already expects.
test("payment plan rows (partial and full) reach the merge result under their real tags", async () => {
  const setup = dependencies({
    loadOpportunity: async () => ({
      id: "opportunity-1",
      company_id: "company-1",
      exhibition_id: "exhibition-1",
      stage: "contract",
      interest_level: 5,
      estimated_value: 10000,
      next_action: null,
      next_action_date: null,
      owner: null,
      price_stand_area_sqm: 12,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      payment_plan: [
        {
          dueDate: "15.09.2026",
          amount: 65000,
          payee: "Terrapinn Katılım Bedeli",
        },
        null,
        { dueDate: null, amount: null, payee: null },
        null,
        {
          dueDate: "15.01.2027",
          amount: 500.5,
          payee: "EXPOVIA Hizmet Bedeli",
        },
      ],
    }),
    // RC-02 — this test's own payment plan totals 65500.50 (65000 +
    // 500.50), not the default fixture's 9810, so the approved price's
    // grand total must match it or the new total-equality check blocks
    // generation before the merge (and mergeResult) is ever produced.
    loadPriceSnapshot: async () => {
      const data = fixtures();
      return {
        ...data.priceSnapshot,
        priceResult: {
          ...data.priceSnapshot.priceResult,
          grandTotal: 65500.5,
        },
      };
    },
  });

  await generateParticipationContract(
    { companyId: "company-1", opportunityId: "opportunity-1" },
    setup.value,
  );

  const values = setup.getGeneratorInput().mergeResult.values;

  assert.equal(
    values["PaymentPlan.Payment1.DueDate"],
    "15.09.2026",
  );
  assert.equal(values["PaymentPlan.Payment1.Amount"], 65000);
  assert.equal(
    values["PaymentPlan.Payment1.Payee"],
    "Terrapinn Katılım Bedeli",
  );

  assert.equal(
    values["PaymentPlan.Payment2.DueDate"],
    undefined,
    "a row missing from the saved array entirely stays blank",
  );
  assert.equal(values["PaymentPlan.Payment2.Amount"], undefined);

  assert.equal(
    values["PaymentPlan.Payment3.DueDate"],
    undefined,
    "an explicitly all-null row stays blank, never a stray 0/empty string",
  );
  // Amount's resolver (unlike DueDate/Payee) passes the raw value
  // through without clean()'s null->undefined normalization, since it's
  // a number field, not a string -- null and undefined are handled
  // identically by the merge's own blank-value rendering either way
  // (wordContentControls.ts), so this is the real, correct value here.
  assert.equal(values["PaymentPlan.Payment3.Amount"], null);
  assert.equal(values["PaymentPlan.Payment3.Payee"], undefined);

  assert.equal(values["PaymentPlan.Payment4.DueDate"], undefined);

  assert.equal(
    values["PaymentPlan.Payment5.DueDate"],
    "15.01.2027",
  );
  assert.equal(values["PaymentPlan.Payment5.Amount"], 500.5);
  assert.equal(
    values["PaymentPlan.Payment5.Payee"],
    "EXPOVIA Hizmet Bedeli",
  );
});

// No payment_plan saved at all (every pre-Sprint-25.8 opportunity) must
// never crash the merge — all 5 rows simply stay blank. RC-02 — a truly
// empty payment plan only clears the new total-equality check when the
// approved grand total is genuinely 0 as well (the exact "canlı iş
// kuralı" carve-out) — modeled here rather than assumed.
test("no payment plan saved yet resolves to all 5 rows blank, without crashing", async () => {
  const setup = dependencies({
    loadOpportunity: async () => {
      const { payment_plan, ...rest } = fixtures().opportunity;
      return rest;
    },
    loadPriceSnapshot: async () => {
      const data = fixtures();
      return {
        ...data.priceSnapshot,
        priceResult: {
          ...data.priceSnapshot.priceResult,
          grandTotal: 0,
        },
      };
    },
  });

  await generateParticipationContract(
    { companyId: "company-1", opportunityId: "opportunity-1" },
    setup.value,
  );

  const values = setup.getGeneratorInput().mergeResult.values;

  for (let n = 1; n <= 5; n += 1) {
    assert.equal(values[`PaymentPlan.Payment${n}.DueDate`], undefined);
    assert.equal(values[`PaymentPlan.Payment${n}.Amount`], undefined);
    assert.equal(values[`PaymentPlan.Payment${n}.Payee`], undefined);
  }
});

// Sprint 25.4 — the contract's address block must show the company's
// open address together with its city and country (previously only the
// single Company.Address line was mapped), using real, already-loaded
// company data rather than any hardcoded value.
test("company city and country are mapped alongside the existing address", async () => {
  const setup = dependencies();
  await generateParticipationContract(
    { companyId: "company-1", opportunityId: "opportunity-1" },
    setup.value,
  );

  const values = setup.getGeneratorInput().mergeResult.values;
  assert.equal(values["Company.Address"], "Çorlu / Tekirdağ");
  assert.equal(values["Company.City"], "Tekirdağ");
  assert.equal(values["Company.Country"], "Türkiye");
});

// Sprint 25.3 — document.issueDate must be a short, deterministic
// dd.MM.yyyy string, never the raw ISO datetime (it wrapped onto a
// second line in the header's narrow cell).
test("document issue date is a formatted dd.MM.yyyy string, not a raw ISO datetime", async () => {
  const setup = dependencies();
  await generateParticipationContract(
    { companyId: "company-1", opportunityId: "opportunity-1" },
    setup.value,
  );

  assert.equal(
    setup.getGeneratorInput().mergeResult.values["Template.sozlesme_tarihi"],
    "31.07.2026",
  );
});

// Sprint 25.3 — document_settings' issuer/bank rows use the literal
// string "TO_BE_DEFINED" as their own not-yet-configured sentinel (see
// document-service's /ready -> businessConfiguration: "demo"). It must
// never leak into the generated PDF as visible text.
test("a document_settings field left as the TO_BE_DEFINED sentinel is treated as empty, not shown literally", async () => {
  const setup = dependencies({
    loadSettings: async () => ({
      issuer: {
        address: "TO_BE_DEFINED",
        mersisNumber: "",
        tradeRegistryNumber: "",
        taxOffice: "",
        taxNumber: "",
        website: "",
        representativeNameTitle: "",
      },
      bank: {
        bankName: "TO_BE_DEFINED",
        branchAddress: "",
        ibanEur: "",
        ibanUsd: "",
      },
    }),
  });

  await generateParticipationContract(
    { companyId: "company-1", opportunityId: "opportunity-1" },
    setup.value,
  );

  const values = setup.getGeneratorInput().mergeResult.values;
  assert.equal(values["Template.expovia_merkez_adresi"], undefined);
  assert.equal(values["Bank.BankName"], undefined);
});

test("returns validation errors and does not generate when contacts are missing", async () => {
  const setup = dependencies({ loadContacts: async () => [] });
  const result = await generateParticipationContract(
    { companyId: "company-1", opportunityId: "opportunity-1" },
    setup.value,
  );

  assert.equal(result.success, false);
  assert.deepEqual(
    result.validationErrors.map((error) => error.code),
    ["PRIMARY_CONTACT_NOT_FOUND", "SIGNATORY_CONTACT_NOT_FOUND"],
  );
  assert.equal(setup.getGeneratorInput(), undefined);
});

test("returns validation error when the approved price snapshot is absent", async () => {
  const setup = dependencies({ loadPriceSnapshot: async () => null });
  const result = await generateParticipationContract(
    { companyId: "company-1", opportunityId: "opportunity-1" },
    setup.value,
  );

  assert.equal(result.success, false);
  assert.equal(result.validationErrors[0].code, "APPROVED_PRICE_NOT_FOUND");
});

// RC-02 — v1 güvenlik kuralı: ödeme planı vadeleri toplamı, onaylı
// fiyatın genel toplamıyla birebir eşleşmelidir (bkz.
// generateParticipationContract.ts's isCloseEnough/sumPaymentPlanAmounts).
function withPaymentPlanAndGrandTotal(paymentPlan, grandTotal) {
  return {
    loadOpportunity: async () => ({
      ...fixtures().opportunity,
      payment_plan: paymentPlan,
    }),
    loadPriceSnapshot: async () => {
      const data = fixtures();
      return {
        ...data.priceSnapshot,
        priceResult: {
          ...data.priceSnapshot.priceResult,
          grandTotal,
        },
      };
    },
  };
}

test("RC-02 test 1: payment plan total equal to the grand total -> contract generates", async () => {
  const setup = dependencies(
    withPaymentPlanAndGrandTotal(
      [
        { dueDate: null, amount: 5000, payee: null },
        { dueDate: null, amount: 4000, payee: null },
        { dueDate: null, amount: 3500, payee: null },
        null,
        null,
      ],
      12500,
    ),
  );

  const result = await generateParticipationContract(
    { companyId: "company-1", opportunityId: "opportunity-1" },
    setup.value,
  );

  assert.equal(result.success, true);
});

test("RC-02 test 2: payment plan total below the grand total -> blocked with the exact shortfall", async () => {
  const setup = dependencies(
    withPaymentPlanAndGrandTotal(
      [
        { dueDate: null, amount: 5000, payee: null },
        { dueDate: null, amount: 4000, payee: null },
        { dueDate: null, amount: 2000, payee: null },
        null,
        null,
      ],
      12500,
    ),
  );

  const result = await generateParticipationContract(
    { companyId: "company-1", opportunityId: "opportunity-1" },
    setup.value,
  );

  assert.equal(result.success, false);
  assert.equal(
    result.validationErrors[0].code,
    "PAYMENT_PLAN_TOTAL_MISMATCH",
  );
  assert.match(result.validationErrors[0].message, /eksiktir/);
  assert.match(result.validationErrors[0].message, /1\.500,00/);
  assert.match(result.validationErrors[0].message, /USD/);
  assert.equal(setup.getGeneratorInput(), undefined);
});

test("RC-02 test 3: payment plan total above the grand total -> blocked with the exact surplus", async () => {
  const setup = dependencies(
    withPaymentPlanAndGrandTotal(
      [
        { dueDate: null, amount: 5000, payee: null },
        { dueDate: null, amount: 4000, payee: null },
        { dueDate: null, amount: 4000, payee: null },
        null,
        null,
      ],
      12500,
    ),
  );

  const result = await generateParticipationContract(
    { companyId: "company-1", opportunityId: "opportunity-1" },
    setup.value,
  );

  assert.equal(result.success, false);
  assert.equal(
    result.validationErrors[0].code,
    "PAYMENT_PLAN_TOTAL_MISMATCH",
  );
  assert.match(result.validationErrors[0].message, /fazladır/);
  assert.match(result.validationErrors[0].message, /500,00/);
  assert.equal(setup.getGeneratorInput(), undefined);
});

test("RC-02 test 4: empty payment plan with a positive grand total -> blocked, never silently allowed", async () => {
  const setup = dependencies(
    withPaymentPlanAndGrandTotal(
      [null, null, null, null, null],
      12500,
    ),
  );

  const result = await generateParticipationContract(
    { companyId: "company-1", opportunityId: "opportunity-1" },
    setup.value,
  );

  assert.equal(result.success, false);
  assert.equal(
    result.validationErrors[0].code,
    "PAYMENT_PLAN_TOTAL_MISMATCH",
  );
});

test("RC-02: an entirely null payment_plan (never saved) with a positive grand total is also blocked", async () => {
  const setup = dependencies(
    withPaymentPlanAndGrandTotal(null, 12500),
  );

  const result = await generateParticipationContract(
    { companyId: "company-1", opportunityId: "opportunity-1" },
    setup.value,
  );

  assert.equal(result.success, false);
  assert.equal(
    result.validationErrors[0].code,
    "PAYMENT_PLAN_TOTAL_MISMATCH",
  );
});

// A genuinely zero grand total is the one case where an empty payment
// plan is legitimate (0 total matches 0 total) — the same equality
// check covers this without any special-cased branch.
test("RC-02: empty payment plan with a genuinely zero grand total is valid", async () => {
  const setup = dependencies(
    withPaymentPlanAndGrandTotal(null, 0),
  );

  const result = await generateParticipationContract(
    { companyId: "company-1", opportunityId: "opportunity-1" },
    setup.value,
  );

  assert.equal(result.success, true);
});

// 0.1 + 0.2 !== 0.3 in raw floating point arithmetic — the comparison
// must be tolerance-based, not a strict ===.
test("RC-02: sub-cent floating point differences are treated as equal, not a mismatch", async () => {
  const setup = dependencies(
    withPaymentPlanAndGrandTotal(
      [
        { dueDate: null, amount: 0.1, payee: null },
        { dueDate: null, amount: 0.2, payee: null },
        null,
        null,
        null,
      ],
      0.3,
    ),
  );

  const result = await generateParticipationContract(
    { companyId: "company-1", opportunityId: "opportunity-1" },
    setup.value,
  );

  assert.equal(result.success, true);
});

test("creates the required timestamped DOCX filename", () => {
  assert.equal(
    createContractDocxFileName({
      companyName: "ABC Mining",
      exhibitionName: "WAMPEX 2027",
      generatedAt: now,
    }),
    "Contract_ABC_Mining_WAMPEX_2027_20260731_143012.docx",
  );
});
