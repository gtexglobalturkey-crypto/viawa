import { approvedPriceKey } from "../../call-workspace/pricing/models/ApprovedPriceSnapshot";
import type { ApprovedPriceSnapshot } from "../../call-workspace/pricing/models/ApprovedPriceSnapshot";
import type { ContractDraftData } from "../../call-workspace/proposal/models/ContractDraftData";
import type {
  ContractDocumentData,
  ContractDocumentStatus,
} from "../models/ContractDocumentData";

const STAND_TYPE_LABELS: Record<
  string,
  string
> = {
  "space-only": "Boş Alan",
  "shell-scheme": "Standart Stand",
  "premium-shell": "Premium Stand",
  custom: "Özel Stand",
  "custom-stand": "Özel Stand",
  outdoor: "Dış Alan",
};

const LOCATION_TYPE_LABELS: Record<
  string,
  string
> = {
  standard: "Standart Konum",
  corner: "Köşe Stand",
  peninsula: "Yarımada Stand",
  island: "Ada Stand",
  "double-deck": "Çift Katlı Stand",
};

// Fixed list per spec section 5 — no data source exists for which
// materials were actually agreed, so every item defaults to
// included:false rather than guessing any of them as provided.
const STAND_MATERIAL_LABELS: string[] = [
  "Alınlık",
  "Dijital baskı",
  "Masa",
  "Sandalye",
  "Raf",
  "Askılık boru",
  "Spot",
  "Çöp kovası",
  "Priz",
  "Buzdolabı",
];

function toUndefinedIfEmpty(
  value: string | null | undefined,
): string | undefined {
  return value?.trim() ? value.trim() : undefined;
}

export type DocumentMeta = {
  documentId: string;
  contractNumber: string;
  version: number;
  createdAt: string;
  status: ContractDocumentStatus;
};

export type MissingFieldWarning = {
  label: string;
};

export type BuildContractDocumentDataResult = {
  data: ContractDocumentData;
  missingFieldLabels: string[];
};

/**
 * Maps the already-accepted ContractDraftData + the ApprovedPriceSnapshot
 * it was built from into the template-facing ContractDocumentData. Prices
 * are read only from the snapshot's PriceResult — nothing is
 * recalculated here. Fields with no real data source stay undefined
 * (never "undefined"/"null"/"NaN" text, never guessed) and are reported
 * back as non-blocking missingFieldLabels for the preview UI to surface.
 */
export function buildContractDocumentData(
  contractDraft: ContractDraftData,
  approvedSnapshot: ApprovedPriceSnapshot,
  documentMeta: DocumentMeta,
): BuildContractDocumentDataResult {
  const priceResult =
    approvedSnapshot.priceResult;
  const priceInput =
    approvedSnapshot.priceInput;

  const exhibitionContactName =
    toUndefinedIfEmpty(
      contractDraft.contacts
        .exhibitionContact?.fullName,
    );

  const signatoryName = toUndefinedIfEmpty(
    contractDraft.contacts.signatoryContact
      ?.fullName,
  );

  const signatoryTitle = toUndefinedIfEmpty(
    contractDraft.contacts.signatoryContact
      ?.title ?? undefined,
  );

  const address = toUndefinedIfEmpty(
    contractDraft.company.address,
  );

  const taxOffice = toUndefinedIfEmpty(
    contractDraft.company.taxOffice,
  );

  const taxNumber = toUndefinedIfEmpty(
    contractDraft.company.taxNumber,
  );

  // Registration Fee / Representative Service Fee no longer get their
  // own contract rows (spec section 3/5) — when a legacy config (Mining
  // Turkey) still produces non-zero values for them, they're folded into
  // "Ek Ücretler" so the total stays accurate instead of silently
  // dropping real money from the printed breakdown.
  const additionalFees =
    priceResult.additionalServicesFee +
    priceResult.registrationFee +
    priceResult.serviceFee;

  const data: ContractDocumentData = {
    document: { ...documentMeta },

    company: {
      companyId:
        contractDraft.company.companyId,
      companyName:
        contractDraft.company.companyName,
      address,
      taxOffice,
      taxNumber,
      phone: toUndefinedIfEmpty(
        contractDraft.company.phone,
      ),
      email: toUndefinedIfEmpty(
        contractDraft.company.email,
      ),
      website: toUndefinedIfEmpty(
        contractDraft.company.website,
      ),
      exhibitionContactName,
      signatoryName,
      signatoryTitle,
    },

    exhibition: {
      exhibitionId:
        contractDraft.exhibition
          .exhibitionId ??
        approvedSnapshot.exhibitionId,
      exhibitionName:
        contractDraft.exhibition
          .exhibitionName ||
        approvedSnapshot.exhibitionName,
      exhibitionShortName:
        toUndefinedIfEmpty(
          contractDraft.exhibition
            .exhibitionShortName,
        ),
      startDate: toUndefinedIfEmpty(
        contractDraft.exhibition.startDate,
      ),
      endDate: toUndefinedIfEmpty(
        contractDraft.exhibition.endDate,
      ),
      city: toUndefinedIfEmpty(
        contractDraft.exhibition.city,
      ),
      country: toUndefinedIfEmpty(
        contractDraft.exhibition.country,
      ),
      // No venue/hall/stand-number data source exists anywhere in the
      // current schema (see prior sprint reports) — always undefined.
      venue: undefined,
      hall: toUndefinedIfEmpty(
        contractDraft.exhibition.hall,
      ),
      standNumber: toUndefinedIfEmpty(
        contractDraft.exhibition
          .standNumber,
      ),
    },

    participation: {
      areaSqm: priceInput.standAreaSqm,
      standTypeLabel:
        STAND_TYPE_LABELS[
          priceInput.standType
        ] ?? priceInput.standType,
      locationTypeLabel:
        LOCATION_TYPE_LABELS[
          priceInput.standLocationType
        ] ?? priceInput.standLocationType,
      standShape: undefined,
    },

    pricing: {
      currency: priceResult.currency,
      sqmAmount: priceResult.sqmAmount,
      locationSurcharge:
        priceResult.locationSurcharge,
      additionalFees,
      discountAmount:
        priceResult.discountAmount,
      taxAmount: priceResult.vatAmount,
      grandTotal: priceResult.grandTotal,
      approvedSnapshotId: approvedPriceKey(
        approvedSnapshot.opportunityId,
        approvedSnapshot.exhibitionId,
      ),
      pricingSource:
        approvedSnapshot.pricingSource,
      pricingSourceVersion:
        approvedSnapshot.pricingSourceVersion,
    },

    paymentPlan: [],
    bankAccounts: [],

    standMaterials:
      STAND_MATERIAL_LABELS.map(
        (label) => ({
          label,
          included: false,
        }),
      ),

    extraMaterialsAndNotes: undefined,
  };

  const missingFieldLabels: string[] = [];

  if (!address) {
    missingFieldLabels.push("Adres");
  }

  if (!taxOffice) {
    missingFieldLabels.push(
      "Vergi Dairesi",
    );
  }

  if (!taxNumber) {
    missingFieldLabels.push("Vergi No");
  }

  if (!exhibitionContactName) {
    missingFieldLabels.push(
      "Fuar Yetkilisi",
    );
  }

  if (!signatoryName) {
    missingFieldLabels.push(
      "İmza Yetkilisi",
    );
  }

  return { data, missingFieldLabels };
}
