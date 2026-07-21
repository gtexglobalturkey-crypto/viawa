import { TEMPLATE_DISPLAY_NAMES } from "../services/templateService";

const templates = [
  "Information Package",
  "Exhibition Presentation",
  "Quotation",
  "Revised Quotation",
  "Contract",
  "Visa Invitation",
  "Visitor Invitation",
  "Thank You",
];

type Props = {
  selected: string;
  onSelect: (template: string) => void;
};

export function EmailTemplateList({ selected, onSelect }: Props) {
  return (
    <div className="data-list" style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px" }}>
      {templates.map((template) => {
        const isSelected = template === selected;

        return (
          <button
            key={template}
            className={isSelected ? "btn btn-primary" : "btn"}
            onClick={() => onSelect(template)}
            style={{
              justifyContent: "flex-start",
              width: "100%",
              minWidth: 0,
              textAlign: "left",
              padding: "8px 10px",
              fontSize: "11px",
              lineHeight: 1.3,
              overflowWrap: "anywhere",
            }}
          >
            {TEMPLATE_DISPLAY_NAMES[
              template
            ] ?? template}
          </button>
        );
      })}
    </div>
  );
}