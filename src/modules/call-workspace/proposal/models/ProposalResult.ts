import type { ProposalItem } from "./ProposalItem";

export type ProposalStatus =
  | "draft"
  | "signed-by-erexpo"
  | "sent"
  | "viewed"
  | "signed-by-customer"
  | "completed"
  | "cancelled";

export type ProposalSignature = {
  signerName: string;
  signerTitle?: string;
  signerEmail?: string;

  signedAt: string;

  ipAddress?: string;
  userAgent?: string;

  signatureMethod:
    | "electronic"
    | "digital-certificate"
    | "manual-upload";

  providerName?: string;
  providerReference?: string;
};

export type ProposalPaymentCategory = "organizer" | "service";

export type ProposalPaymentStatus =
  | "pending"
  | "paid"
  | "overdue"
  | "cancelled";

export type ProposalPaymentInstallment = {
  id: string;
  dueDate: string;
  amount: number;
  currency: string;
  category: ProposalPaymentCategory;
  status: ProposalPaymentStatus;
  description?: string;
  paidAt?: string;
};

export type ProposalResult = {
  proposalNumber: string;

  createdAt: string;
  validUntil: string;

  companyId: string;
  companyName: string;

  exhibitionId: string;
  exhibitionName: string;

  representativeName: string;

  items: ProposalItem[];

  subtotal: number;
  discount: number;
  vat: number;
  grandTotal: number;

  currency: string;

  paymentTerms: string;

  notes?: string;

  organizerName?: string;
  organizerParticipationFee?: number;
  serviceFee?: number;
  serviceFeeApplied?: boolean;
  serviceFeeWaiverReason?: string;
  paymentSchedule?: ProposalPaymentInstallment[];

  status?: ProposalStatus;

  version?: number;

  erexpoSignature?: ProposalSignature;
  customerSignature?: ProposalSignature;

  sentAt?: string;
  viewedAt?: string;
  completedAt?: string;

  documentHash?: string;
  signedDocumentUrl?: string;
};