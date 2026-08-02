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

export type ExhibitionOption = {
  id: string;
  label: string;
};

type Props = {
  workspace: CallWorkspaceViewModel;
  activeExhibitionId?: string | null;
  exhibitionOptions?: ExhibitionOption[];
  onActiveExhibitionChange?: (
    exhibitionId: string,
  ) => void;
};

export function FairPanel({
  workspace,
  activeExhibitionId,
  exhibitionOptions = [],
  onActiveExhibitionChange,
}: Props) {
  const exhibition =
    workspace.exhibition;

  const opportunity =
    workspace.opportunity;

  const selectedExhibitionId =
    activeExhibitionId ??
    exhibition.id ??
    "";

  const hasMultipleExhibitions =
    exhibitionOptions.length > 1;

  return (
    <Panel className="exhibition-snapshot-panel">
      <p className="eyebrow">
        Aktif Fuar
      </p>

      {exhibitionOptions.length > 0 && (
        <div className="exhibition-active-selector">
          <label htmlFor="active-exhibition">
            Görüşülen Fuar
          </label>

          <select
            id="active-exhibition"
            value={selectedExhibitionId}
            disabled={
              !hasMultipleExhibitions ||
              !onActiveExhibitionChange
            }
            onChange={(event) =>
              onActiveExhibitionChange?.(
                event.target.value,
              )
            }
          >
            {exhibitionOptions.map(
              (option) => (
                <option
                  key={option.id}
                  value={option.id}
                >
                  {option.label}
                </option>
              ),
            )}
          </select>

          {!hasMultipleExhibitions && (
            <small className="muted">
              Bu firma için tek fuar fırsatı
              bulunuyor.
            </small>
          )}
        </div>
      )}

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
            Teklif Tutarı
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
            {opportunity.stageLabel}
          </span>
        </div>

        <div>
          <LayoutGrid size={15} />
          <span>{opportunity.standTypeLabel}</span>
        </div>

        <div>
          <BadgeEuro size={15} />
          <span>
            {opportunity.quotationSent
              ? "Teklif Gönderildi"
              : exhibition.quotationStatus}
          </span>
        </div>

        <div>
          <Map size={15} />
          <span>
            {opportunity.nextAction || "—"} • {opportunity.nextActionDateLabel}
          </span>
        </div>

        <div>
          <FileSignature size={15} />
          <span>{opportunity.priceCalculatedDateLabel}</span>
        </div>
      </div>
    </Panel>
  );
}
