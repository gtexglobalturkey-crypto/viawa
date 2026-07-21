import {
  BadgeEuro,
  Building2,
  FileSignature,
  LayoutGrid,
  Map,
  Ruler,
} from "lucide-react";

import { Panel } from "../../../components/ui/Panel";

import type { CallWorkspaceViewModel } from "../models/workspaceViewModel";

type Props = {
  workspace: CallWorkspaceViewModel;
};

export function FairPanel({
  workspace,
}: Props) {
  const exhibition =
    workspace.exhibition;

  const opportunity =
    workspace.opportunity;

  return (
    <Panel className="exhibition-snapshot-panel">
      <p className="eyebrow">
        Fuar Özeti
      </p>

      <div className="exhibition-snapshot-head">
        <div className="exhibition-snapshot-icon">
          <Building2 size={20} />
        </div>

        <div>
          <h2>{exhibition.name}</h2>

          <p className="muted">
            {opportunity.stageLabel}
          </p>
        </div>
      </div>

      <div className="exhibition-snapshot-list">
        <div>
          <span>
            <LayoutGrid size={14} />
            Salon
          </span>

          <strong>{exhibition.hall}</strong>
        </div>

        <div>
          <span>
            <Building2 size={14} />
            Stand
          </span>

          <strong>{exhibition.booth}</strong>
        </div>

        <div>
          <span>
            <Ruler size={14} />
            Stand Alanı
          </span>

          <strong>
            {exhibition.standSizeLabel}
          </strong>
        </div>

        <div>
          <span>
            <BadgeEuro size={14} />
            Tahmini Değer
          </span>

          <strong>
            {
              opportunity
                .formattedEstimatedValue
            }
          </strong>
        </div>
      </div>

      <div className="exhibition-status-list">
        <div>
          <Map size={15} />

          <span>
            {exhibition.floorPlanStatus}
          </span>
        </div>

        <div>
          <FileSignature size={15} />

          <span>
            {exhibition.quotationStatus}
          </span>
        </div>
      </div>
    </Panel>
  );
}