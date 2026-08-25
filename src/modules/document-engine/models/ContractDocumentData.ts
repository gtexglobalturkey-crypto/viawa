export type ContractDocumentStatus =
  | "draft"
  | "completed"
  | "pdf-generated"
  | "sent-for-signature"
  | "signed";

/**
 * Everything the participation-contract template needs to render, fully
 * resolved ahead of time. The template itself never reaches back into
 * Company/Contact/Exhibition/Opportunity/ApprovedPriceSnapshot — it only
 * ever reads this one object (see engine/buildContractDocumentData.ts).
 */
export type ContractDocumentData = {
  document: {
    documentId: string;
    contractNumber: string;
    version: number;
    createdAt: string;
    status: ContractDocumentStatus;
  };

  company: {
    companyId: string;
    companyName: string;
    address?: string;
    taxOffice?: string;
    taxNumber?: string;
    phone?: string;
    email?: string;
    website?: string;
    exhibitionContactName?: string;
    signatoryName?: string;
    signatoryTitle?: string;
  };

  exhibition: {
    exhibitionId: string;
    exhibitionName: string;
    exhibitionShortName?: string;
    startDate?: string;
    endDate?: string;
    city?: string;
    country?: string;
    venue?: string;
    hall?: string;
    standNumber?: string;
  };

  participation: {
    areaSqm: number;
    standTypeLabel: string;
    locationTypeLabel?: string;
    standShape?: string;
  };

  pricing: {
    currency: string;
    sqmAmount: number;
    locationSurcharge: number;
    additionalFees: number;
    discountAmount: number;
    taxAmount: number;
    grandTotal: number;
    approvedSnapshotId: string;
    pricingSource?: string;
    pricingSourceVersion?: string;
  };

  paymentPlan: Array<{
    label: string;
    amount?: number;
    dueDate?: string;
  }>;

  bankAccounts: Array<{
    currency: string;
    iban: string;
    bankName?: string;
  }>;

  standMaterials: Array<{
    label: string;
    included: boolean;
  }>;

  extraMaterialsAndNotes?: string;
};
