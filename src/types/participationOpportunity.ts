export type ParticipationStage =
  | "market_selection"
  | "discovery"
  | "interested"
  | "quotation"
  | "negotiation"
  | "contract"
  | "payment"
  | "confirmed"
  | "lost";

export type ParticipationStatus =
  | "new"
  | "active"
  | "waiting"
  | "won"
  | "lost";

export type Currency = "EUR" | "USD" | "TRY";

export type ParticipationOpportunity = {
  id: string;

  // Relations
  companyId: string;
  contactId?: string;
  exhibitionId: string;

  // Sales
  stage: ParticipationStage;
  status: ParticipationStatus;
  plannedSqm?: number;
  standType?: string;
  hall?: string;
  standNo?: string;

  // Financials
  currency: Currency;
  organizerContractAmount?: number;
  representativeServiceFee?: number;
  totalCustomerAmount?: number;
  paymentStatus?: string;

  // Workflow
  lastContact?: string;
  nextAction?: string;
  nextActionDate?: string;
  expectedCloseDate?: string;

  // Notes
  notes?: string;
};