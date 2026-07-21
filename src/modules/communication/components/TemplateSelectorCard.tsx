import { Panel } from "../../../components/ui/Panel";

import { EmailTemplateList } from "./EmailTemplateList";

type Props = {
  selectedTemplate: string;
  onSelectTemplate: (
    template: string,
  ) => void;
};

export function TemplateSelectorCard({
  selectedTemplate,
  onSelectTemplate,
}: Props) {
  return (
    <Panel>
      <p className="eyebrow">
        İletişim İşlemleri
      </p>

      <EmailTemplateList
        selected={selectedTemplate}
        onSelect={onSelectTemplate}
      />
    </Panel>
  );
}