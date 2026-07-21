import {
  Building2,
  Globe2,
  Mail,
  Phone,
  Star,
  UserRound,
} from "lucide-react";

import { Panel } from "../../../components/ui/Panel";

import type { CallWorkspaceViewModel } from "../models/workspaceViewModel";

type Props = {
  workspace: CallWorkspaceViewModel;
};

function getRelationshipLabel(
  probability: number | null,
) {
  if (probability !== null && probability >= 75) {
    return "Güçlü";
  }

  if (probability !== null && probability >= 40) {
    return "Gelişiyor";
  }

  return "Erken";
}

function getInitials(
  fullName: string,
): string {
  const words = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "—";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function CustomerPanel({
  workspace,
}: Props) {
  const relationship = getRelationshipLabel(
    workspace.opportunity.probability,
  );

  const initials = getInitials(
    workspace.customer.fullName,
  );

  return (
    <Panel className="customer-snapshot-panel">
      <p className="eyebrow">
        Müşteri Özeti
      </p>

      <div className="customer-snapshot-head">
        <div className="customer-avatar">
          {initials || (
            <UserRound size={22} />
          )}
        </div>

        <div className="customer-snapshot-name">
          <h2>
            {workspace.customer.fullName}
          </h2>

          <p className="muted">
            {workspace.customer.title}
          </p>
        </div>
      </div>

      <div className="customer-snapshot-list">
        <div>
          <span>
            <Phone size={14} />
            Telefon
          </span>

          <strong>
            {workspace.customer.phone}
          </strong>
        </div>

        <div>
          <span>
            <Mail size={14} />
            E-posta
          </span>

          <strong>
            {workspace.customer.email}
          </strong>
        </div>

        <div>
          <span>
            <Building2 size={14} />
            Firma
          </span>

          <strong>
            {workspace.company.name}
          </strong>
        </div>

        <div>
          <span>
            <Globe2 size={14} />
            Ülke
          </span>

          <strong>
            {workspace.company.country}
          </strong>
        </div>

        <div>
          <span>
            <Star size={14} />
            İlişki
          </span>

          <strong>{relationship}</strong>
        </div>

        <div>
          <span>Son İletişim</span>

          <strong>
            {
              workspace.opportunity
                .lastContactDateLabel
            }
          </strong>
        </div>
      </div>
    </Panel>
  );
}