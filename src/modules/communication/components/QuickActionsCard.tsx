import { Panel } from "../../../components/ui/Panel";

import { TEMPLATE_DISPLAY_NAMES } from "../services/templateService";

type Props = {
  companyName: string;
  selectedTemplate: string;
};

export function QuickActionsCard({
  companyName,
  selectedTemplate,
}: Props) {
  return (
    <Panel>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <p className="eyebrow" style={{ margin: 0 }}>
          Hızlı İşlemler
        </p>

        <div className="communication-quick-actions">
          <p className="muted">
            Müşteri
          </p>

          <strong>{companyName}</strong>

          <p className="muted">
            Seçili İletişim
          </p>

          <strong>
            {TEMPLATE_DISPLAY_NAMES[
              selectedTemplate
            ] ?? selectedTemplate}
          </strong>
        </div>
      </div>
    </Panel>
  );
}