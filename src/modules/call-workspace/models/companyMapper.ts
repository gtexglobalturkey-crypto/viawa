import type {
  Company,
} from "../../../types/database";

import type {
  WorkspaceCompany,
  WorkspaceCustomer,
} from "./workspaceViewModel";

type WorkspaceCompanyResult = {
  company: WorkspaceCompany;
  customer: WorkspaceCustomer;
};

export function mapWorkspaceCompany(
  company: Company,
): WorkspaceCompanyResult {
  const contactName =
    company.contact_person?.trim() ||
    "No primary contact";

  return {
    company: {
      id: company.id,
      name: company.company_name,
      industry:
        company.industry ??
        "Not assigned",
      country:
        company.country ??
        "Not recorded",
      city: "Not recorded",
      location:
        company.country ??
        "Not recorded",
      website:
        company.website ??
        "Not recorded",
      email:
        company.email ??
        "Not recorded",
      phone:
        company.phone ??
        "Not recorded",
      notes: "",
      status: company.status,
      createdAt: company.created_at,
      updatedAt: company.updated_at,
    },

    customer: {
      id: null,
      firstName: contactName,
      lastName: "",
      fullName: contactName,
      title: "Role not assigned",
      email:
        company.email ??
        "Not recorded",
      phone:
        company.phone ??
        "Not recorded",
      isPrimary: Boolean(
        company.contact_person,
      ),
    },
  };
}