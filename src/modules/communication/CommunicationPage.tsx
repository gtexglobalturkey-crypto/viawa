import { useSearchParams } from "react-router-dom";

import { Panel } from "../../components/ui/Panel";
import { useCommunicationWorkspace } from "../../hooks/useCommunicationWorkspace";

import { AttachmentCard } from "./components/AttachmentCard";
import { CommunicationHeader } from "./components/CommunicationHeader";
import { CommunicationHistoryCard } from "./components/CommunicationHistoryCard";
import { ComposerCard } from "./components/ComposerCard";
import { QuickActionsCard } from "./components/QuickActionsCard";
import { TemplateSelectorCard } from "./components/TemplateSelectorCard";

const VALID_TEMPLATE_IDS = [
  "Information Package",
  "Exhibition Presentation",
  "Quotation",
  "Revised Quotation",
  "Contract",
  "Visa Invitation",
  "Visitor Invitation",
  "Thank You",
];

export function CommunicationPage() {
  const [searchParams] = useSearchParams();

  const companyId =
    searchParams.get("companyId") ?? undefined;

  const opportunityId =
    searchParams.get("opportunityId");

  const requestedTemplate =
    searchParams.get("template");

  const initialTemplate =
    requestedTemplate &&
    VALID_TEMPLATE_IDS.includes(
      requestedTemplate,
    )
      ? requestedTemplate
      : "Information Package";

  const {
    company,
    loading,
    error,
    selectedOpportunity,
    selectedTemplate,
    subject,
    body,
    attachments,
    communicationHistory,
    sending,
    sendError,
    sendSuccess,
    handleTemplateSelect,
    handleSendEmail,
  } = useCommunicationWorkspace({
    companyId,
    opportunityId,
    initialTemplate,
  });

  if (loading) {
    return (
      <main className="page">
        <Panel>
          <p className="eyebrow">
            İletişim Çalışma Alanı
          </p>

          <h2>
            İletişim verileri yükleniyor...
          </h2>

          <p className="muted">
            Atlas müşteri ve fırsat bilgilerini
            yüklüyor.
          </p>
        </Panel>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page">
        <Panel>
          <p className="eyebrow">
            İletişim Çalışma Alanı
          </p>

          <h2>
            İletişim verileri yüklenemedi
          </h2>

          <p className="muted">
            {error}
          </p>
        </Panel>
      </main>
    );
  }

  if (
    !company ||
    !selectedOpportunity
  ) {
    return (
      <main className="page">
        <Panel>
          <p className="eyebrow">
            İletişim Çalışma Alanı
          </p>

          <h2>
            Müşteri seçilmedi
          </h2>

          <p className="muted">
            E-posta hazırlamadan önce bir firma
            veya Satış Görüşmesi ekranı açın.
          </p>
        </Panel>
      </main>
    );
  }

  return (
    <main className="page">
      <CommunicationHeader
        companyName={company.company_name}
      />

      <div className="communication-workspace">
        <div className="communication-left-column">
          <TemplateSelectorCard
            selectedTemplate={
              selectedTemplate
            }
            onSelectTemplate={
              handleTemplateSelect
            }
          />

          <QuickActionsCard
            companyName={
              company.company_name
            }
            selectedTemplate={
              selectedTemplate
            }
          />
        </div>

        <div className="communication-center-column">
          <ComposerCard
            subject={subject}
            body={body}
            sending={sending}
            sendError={sendError}
            sendSuccess={sendSuccess}
            onSend={handleSendEmail}
          />
        </div>

        <div className="communication-right-column">
          <AttachmentCard
            attachments={attachments}
          />

          <CommunicationHistoryCard
            emails={communicationHistory}
          />
        </div>
      </div>
    </main>
  );
}