import {
  Mail,
  Phone,
  UserRound,
} from "lucide-react";

import { Panel } from "../../../components/ui/Panel";

import type { CallWorkspaceViewModel } from "../models/workspaceViewModel";

type Props = {
  workspace: CallWorkspaceViewModel;
};

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
