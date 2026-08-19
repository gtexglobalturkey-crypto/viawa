export interface Company {
  id: string;

  /**
   * Permanent, unique, business-facing "Firma ID" (VWA-000001, ...),
   * generated at the database level by
   * supabase/migrations/20260728_add_company_code.sql. Read-only from the
   * app — never send this on insert/update (see companyService.ts).
   * Optional/nullable here the same way tax_office etc. below are: until
   * that migration is run against this environment, the column doesn't
   * exist yet and PostgREST simply omits it from the response.
   */
  company_code?: string | null;

  company_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;

  country: string | null;
  industry: string | null;

  /**
   * Letterhead (kaşe) fields, added by
   * supabase/migrations/20260724_add_company_letterhead_and_contacts.sql
   * (applied 2026-07-24).
   */
  tax_office?: string | null;
  tax_number?: string | null;
  postal_code?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;

  status: string;

  created_at: string;
  updated_at: string;
}

/**
 * Master list of sectors, added by
 * supabase/migrations/20260728_add_sectors_and_product_groups.sql. A
 * company may reference up to 4 of these via `company_sectors`
 * (position 1 is the primary sector and is mirrored into
 * `Company.industry` for backward compatibility). This is unrelated to
 * the legacy demo-only `Sector` type in src/types/sector.ts, which
 * backs the hardcoded MasterDataPage list, not a real table.
 */
export interface Sector {
  id: string;
  name: string;
  normalized_name: string;
  is_active: boolean;
  created_at: string;
}

/** Same shape/purpose as Sector, for product groups. */
export interface ProductGroup {
  id: string;
  name: string;
  normalized_name: string;
  is_active: boolean;
  created_at: string;
}

/**
 * A company's sectors, in order (position 1-4). Rows are only ever
 * replaced as a whole set via the replace_company_sectors RPC — see
 * src/services/supabase/sectorService.ts — never updated in place.
 */
export interface CompanySector {
  company_id: string;
  sector_id: string;
  position: number;
}

/** Same shape/purpose as CompanySector, for product groups. */
export interface CompanyProductGroup {
  company_id: string;
  product_group_id: string;
  position: number;
}

/**
 * Real, existing table (verified via PostgREST on 2026-07-24). Not a new
 * data model — this table already existed in Supabase, unused by the app
 * until now. A company may have at most 4 contacts.
 *
 * `is_primary` and `is_signatory` are independent roles (Fuar Yetkilisi /
 * Ana İletişim Kişisi, and İmza Yetkilisi) — a contact may hold both, one,
 * or neither. No role is auto-assigned; both default to false. The future
 * contract-preparation flow is expected to read `is_primary` for the
 * exhibition/main contact and `is_signatory` for the signing contact.
 */
export interface Contact {
  id: string;

  company_id: string;

  first_name: string | null;
  last_name: string | null;
  title: string | null;
  phone: string | null;
  email: string | null;

  is_primary: boolean;
  is_signatory: boolean;

  created_at: string;
  updated_at: string;
}

export interface Exhibition {
  id: string;

  name: string;
  city: string | null;
  country: string | null;

  sector: string | null;
  organizer: string | null;

  start_date: string | null;
  end_date: string | null;

  created_at: string;
  updated_at: string;
}

export interface Opportunity {
  id: string;

  company_id: string;
  exhibition_id: string | null;
  contact_id?: string | null;

  stage: string;

  interest_level: number;

  estimated_value: number;

  next_action: string | null;
  next_action_date: string | null;

  owner: string | null;

  // Approved Fuar Repository price breakdown for this opportunity — see
  // supabase/migrations/20260730040000_add_opportunity_price_fields.sql.
  // Optional (nullable, no DB default) until a price has actually been
  // approved (CustomerWorkspace.handlePriceCalculated) — `?` here (not
  // just `| null`) so existing createOpportunity call sites that never
  // mention pricing (e.g. NewCompanyPage.tsx) keep compiling unchanged.
  // Written alongside, not instead of, the existing localStorage
  // ApprovedPriceSnapshot the contract-generation pipeline reads from.
  price_stand_type?: string | null;
  price_stand_area_sqm?: number | null;
  price_location_surcharge_type?:
    | string
    | null;
  price_currency?: string | null;
  price_base_amount?: number | null;
  price_location_surcharge_amount?:
    | number
    | null;
  price_registration_fee?:
    | number
    | null;
  price_service_fee?: number | null;
  price_subtotal?: number | null;
  price_vat_rate?: number | null;
  price_vat_amount?: number | null;
  price_grand_total?: number | null;
  price_calculated_at?: string | null;

  // Sprint 25.5 — set only by "Fırsatı Kapat" (see
  // supabase/migrations/20260801110000_add_opportunity_closure_fields.sql).
  // closure_reason/closure_note apply to Lost only; closed_at is written
  // for both Won and Lost. All null until the opportunity is explicitly
  // closed via that flow — a pre-existing 'signed'/'lost' row from before
  // this sprint has none of these set.
  closed_at?: string | null;
  closure_reason?: string | null;
  closure_note?: string | null;

  // Sprint 25.8 — the participation contract's "Stand Malzemeleri" data
  // entry (see
  // supabase/migrations/20260803090000_add_opportunity_stand_materials.sql).
  // Keyed by the same material keys
  // participationContractMapping.ts's MATERIAL_KEYS already reads
  // (Table, Shelf, HangingRail, Spotlight, PowerSocket, Refrigerator,
  // InfoDesk, Chair, WasteBin, HeaderText, DigitalPrints, Other).
  // extra_information holds up to 3 free-text lines (ExtraInformation.Line1-3).
  // Both null until a user has edited stand materials for this opportunity.
  stand_materials?: Readonly<
    Record<string, OpportunityStandMaterial>
  > | null;
  extra_information?: readonly string[] | null;

  // Sprint 25.8 / Adım 2 — the participation contract's "Ödeme Planı"
  // data entry (see
  // supabase/migrations/20260803100000_add_opportunity_payment_plan.sql).
  // Up to 5 independent entries, matching
  // PaymentPlan.Payment1-5.DueDate/.Amount/.Payee in
  // participationContractMapping.ts. Rows are independent — a shorter
  // array (or null) simply leaves the remaining rows blank, never
  // auto-filled or auto-totaled.
  payment_plan?: readonly OpportunityPaymentPlanItem[] | null;

  created_at: string;
  updated_at: string;
}

export type OpportunityStandMaterial = {
  selected: boolean;
  quantity?: number | null;
};

export type OpportunityPaymentPlanItem = {
  dueDate?: string | null;
  amount?: number | null;
  payee?: string | null;
};

export interface TimelineEvent {
  id: string;

  company_id: string;

  opportunity_id: string | null;

  type: string | null;

  title: string;

  description: string | null;

  created_at: string;
}

export interface Reminder {
  id: string;

  company_id: string;

  opportunity_id?: string | null;

  task_type?: string | null;

  title: string;

  due_date: string | null;

  completed: boolean;

  created_at: string;
  updated_at: string;
}

export interface EmailRecord {
  id: string;

  company_id: string;

  to_recipients?: string[];

  cc_recipients?: string[];

  bcc_recipients?: string[];

  send_operation_key?: string | null;

  subject: string | null;

  body: string | null;

  status: string;

  sent_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface AiMemory {
  id: string;

  company_id: string;

  summary: string | null;

  risk: string | null;

  recommendation: string | null;

  confidence: number;

  created_at: string;
  updated_at: string;
}

export interface CallNote {
  id: string;

  company_id: string;

  opportunity_id: string;

  note: string;

  created_by: string | null;

  created_at: string;
  updated_at: string;
}

// RC-AUTH — the app-level authorization record for a signed-in Supabase
// Auth user. A Supabase session alone never grants VIAWA access: this
// row (created/edited only via the Supabase Dashboard, never by the
// app) is what decides it. id is the same uuid as auth.users.id.
export type ApplicationUserRole = "admin" | "representative";

export interface ApplicationUser {
  id: string;

  email: string;

  full_name: string | null;

  role: ApplicationUserRole;

  is_active: boolean;

  created_at: string;
  updated_at: string;
}
