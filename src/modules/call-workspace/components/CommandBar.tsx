import {
  CalendarDays,
  Phone,
} from "lucide-react";

import type { CallWorkspaceViewModel } from "../models/workspaceViewModel";

type Props = {
  workspace: CallWorkspaceViewModel;
};

export function CommandBar({
  workspace,
}: Props) {
  return (
    <section className="sw-compact-command-bar">
      <div className="command-card compact current-contact-card">
        <Phone size={18} strokeWidth={2} />

        <div className="command-card-content">
          <span>Mevcut Kişi</span>

          <strong>
            {workspace.customer.fullName}
          </strong>
        </div>
      </div>

      <div className="command-card compact next-activity-card">
        <CalendarDays size={18} strokeWidth={2} />

        <div className="command-card-content">
          <span>Sonraki Aktivite</span>

          <strong>
            {workspace.opportunity.nextAction}
          </strong>
        </div>
      </div>
    </section>
  );
}