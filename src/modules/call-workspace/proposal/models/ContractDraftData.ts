import type {
  PriceInput,
  StandType,
} from "../../pricing/models/PriceInput";
import type { PriceResult } from "../../pricing/models/PriceResult";

/**
 * A single company contact referenced by role (Fuar Yetkilisi /
 * İmza Yetkilisi). Null when no contact with that role could be found —
 * never guessed/auto-assigned from an unrelated contact.
 */
export type ContractDraftContact = {
  contactId: string;
  fullName: string;
  title: string | null;
  phone: string | null;
  email: string | null;
};

export type ContractDraftCompany = {
  companyId: string;
  companyName: string;
  address: string | null;
  taxOffice: string | null;
  taxNumber: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
};

export type ContractDraftContacts = {
  exhibitionContact: ContractDraftContact | null;
  signatoryContact: ContractDraftContact | null;
};

export type ContractDraftExhibition = {
  exhibitionId: string | null;
  exhibitionName: string;
  exhibitionShortName: string | null;
  startDate: string | null;
  endDate: string | null;
  city: string | null;
  country: string | null;
  hall: string | null;
  standNumber: string | null;
  standType: StandType;
};

export type ContractDraftPrice = {
  priceInput: PriceInput;
  priceResult: PriceResult;
};

export type ContractDraftStatus = "draft";

/**
 * The data snapshot handed from the "Fiyatı Onayla" moment to the
 * "Sözleşme Hazırla" flow. Built fresh from the current company, contacts,
 * exhibition and approved price every time it's needed — it is not itself
 * a separate piece of persisted state, since its inputs (approved price,
 * company record, contacts, exhibition record) are already the sources of
 * truth. Fields with no real data source are left null rather than
 * guessed (see section 6 of the originating spec).
 */
export type ContractDraftData = {
  company: ContractDraftCompany;
  contacts: ContractDraftContacts;
  exhibition: ContractDraftExhibition;
  price: ContractDraftPrice;

  opportunityId: string;
  contractNumber: string | null;
  issueDate: string;
  currency: string;
  status: ContractDraftStatus;
};
