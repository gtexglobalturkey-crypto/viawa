import { useMemo } from "react";
import {
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { Panel } from "../../components/ui/Panel";
import { useCommunicationWorkspace } from "../../hooks/useCommunicationWorkspace";

import { sanitizeSelectedDocumentBasketItems } from "../call-workspace/document-basket";
import { sanitizeSelectedExhibitionDocuments } from "../exhibitions/utils/sanitizeSelectedExhibitionDocuments";

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
  const location = useLocation();
  const navigate = useNavigate();

  const companyId =
    searchParams.get("companyId") ?? undefined;

  const opportunityId =
    searchParams.get("opportunityId");

  const selectedContactId =
    searchParams.get("selectedContactId");

  const requestedTemplate =
    searchParams.get("template");

  const initialTemplate =
    requestedTemplate &&
    VALID_TEMPLATE_IDS.includes(
      requestedTemplate,
    )
      ? requestedTemplate
      : "Information Package";

  const originRoute = useMemo(() => {
    const candidate = (
      location.state as { originRoute?: unknown } | null
    )?.originRoute;

    if (typeof candidate !== "string" || !companyId || !opportunityId) {
      return null;
    }

    try {
      const parsed = new URL(candidate, window.location.origin);

      return parsed.pathname === "/call" &&
        parsed.searchParams.get("companyId") === companyId &&
        parsed.searchParams.get("opportunityId") === opportunityId
        ? `${parsed.pathname}${parsed.search}`
        : null;
    } catch {
      return null;
    }
  }, [companyId, location.state, opportunityId]);

  // Populated only when arriving from the Working Space's "E-posta" tool
  // (via navigate(..., { state })); a direct visit to /communication has
  // no history state, so this safely falls back to an empty list.
  const documentBasketItems = useMemo(() => {
    const routerState = location.state as
      | { documentBasketItems?: unknown }
      | null
      | undefined;

    return sanitizeSelectedDocumentBasketItems(
      routerState?.documentBasketItems,
    );
  }, [location.state]);

  // Same idea, for the real per-exhibition documents checked off in
  // Exhibition Workspace.
  const exhibitionDocuments = useMemo(() => {
    const routerState = location.state as
      | { exhibitionDocuments?: unknown }
      | null
      | undefined;

    return sanitizeSelectedExhibitionDocuments(
      routerState?.exhibitionDocuments,
    );
  }, [location.state]);

  const {
    company,
    loading,
    error,
    selectedOpportunity,
    selectedTemplate,
    subject,
    body,
    attachments,
    recipientOptions,
    toRecipients,
    ccRecipients,
    bccRecipients,
    communicationHistory,
    communicationContext,
    sending,
    sendError,
    sendSuccess,
    handleTemplateSelect,
    handleSendEmail,
    setToRecipients,
    setCcRecipients,
    setBccRecipients,
  } = useCommunicationWorkspace({
    companyId,
    opportunityId,
    selectedContactId,
    initialTemplate,
    documentBasketItems,
    exhibitionDocuments,
  });

  async function handleCompletedSend(
    emailSubject: string,
    emailBody: string,
  ): Promise<void> {
    const completion = await handleSendEmail(
      emailSubject,
      emailBody,
    );

    if (!completion) return;

    const fallbackRoute = `/call?companyId=${encodeURIComponent(
      completion.companyId,
    )}&opportunityId=${encodeURIComponent(
      completion.opportunityId,
    )}`;

    navigate(originRoute ?? fallbackRoute, {
      replace: true,
      state: {
        quotationSent: true,
        companyId: completion.companyId,
        opportunityId: completion.opportunityId,
        emailId: completion.emailId,
        sentAt: completion.sentAt,
      },
    });
  }

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
            VIAWA müşteri ve fırsat bilgilerini
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
    !selectedOpportunity ||
    !communicationContext
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
            context={communicationContext}
            selectedTemplate={
              selectedTemplate
            }
          />
        </div>

        <div className="communication-center-column">
          <ComposerCard
            subject={subject}
            body={body}
            recipientOptions={recipientOptions}
            toRecipients={toRecipients}
            ccRecipients={ccRecipients}
            bccRecipients={bccRecipients}
            onToChange={setToRecipients}
            onCcChange={setCcRecipients}
            onBccChange={setBccRecipients}
            sending={sending}
            sendError={sendError}
            sendSuccess={sendSuccess}
            onSend={handleCompletedSend}
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
