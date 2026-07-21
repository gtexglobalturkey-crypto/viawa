export type RelationshipLevel =
  | "new"
  | "warm"
  | "strong"
  | "strategic";

export type CompanyStatus =
  | "lead"
  | "active"
  | "proposal"
  | "customer"
  | "lost";

export type Company = {
  id: string;

  // General
  name: string;

  country: string;
  city?: string;
  address?: string;
  postalCode?: string;

  // Master Data Relations
  sectorIds: string[];
  productGroupIds: string[];
  exhibitionInterestIds: string[];

  // Business
  website?: string;
  products?: string;

  // Tax Information
  taxOffice?: string;
  taxNumber?: string;

  // CRM
  status: CompanyStatus;
  relationship: RelationshipLevel;

  lastContact?: string;
  nextAction?: string;

  notes?: string;

  potentialValue?: number;
};

export type Contact = {
  id: string;
  companyId: string;

  name: string;
  role: string;

  phone?: string;
  mobile?: string;
  whatsapp?: string;

  email?: string;
  secondEmail?: string;

  isDecisionMaker: boolean;
};