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
    resolveContractNumber: async () => "EXP-2027-000001",
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
