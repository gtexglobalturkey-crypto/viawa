import {
  useMemo,
  useState,
} from "react";

import { createEmail } from "../services/supabase/emailService";

import { executeAction } from "../features/execution";

import { useWorkspaceData } from "../modules/call-workspace/hooks/useWorkspaceData";

import { getAttachments } from "../modules/communication/services/attachmentService";

import {
  getTemplateBody,
  getTemplateSubject,
} from "../modules/communication/services/templateService";

const TEMPLATE_ACTION_IDS: Record<
  string,
  string
> = {
  "Information Package":
    "information-package",
  Quotation: "quotation",
  Contract: "contract",
  "Additional Documents":
    "additional-documents",
  "Revised Quotation":
    "revised-quotation",
  "Thank You": "thank-you",
  "Exhibition Presentation":
    "information-package",
  "Visa Invitation":
    "additional-documents",
  "Visitor Invitation":
    "additional-documents",
};

function mapTemplateToActionId(
  template: string,
): string {
  return (
    TEMPLATE_ACTION_IDS[template] ??
    "additional-documents"
  );
}

type UseCommunicationWorkspaceParams = {
  companyId?: string;
  opportunityId?: string | null;
  initialTemplate: string;
};

export function useCommunicationWorkspace({
  companyId,
  opportunityId,
  initialTemplate,
}: UseCommunicationWorkspaceParams) {
  const {
    company,
    opportunities,
    emails,
    loading,
    error,
  } = useWorkspaceData(companyId);

  const [
    selectedTemplate,
    setSelectedTemplate,
  ] = useState(initialTemplate);

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    sendError,
    setSendError,
  ] = useState<string | null>(null);

  const [
    sendSuccess,
    setSendSuccess,
  ] = useState<string | null>(null);

  const selectedOpportunity =
    useMemo(() => {
      if (!opportunityId) {
        return (
          opportunities[0] ??
          null
        );
      }

      return (
        opportunities.find(
          (opportunity) =>
            opportunity.id ===
            opportunityId,
        ) ??
        opportunities[0] ??
        null
      );
    }, [
      opportunities,
      opportunityId,
    ]);

  const companyName =
    company?.company_name ?? "";

  const exhibitionName =
    selectedOpportunity
      ? "Fuar Katılımı"
      : "";
  const subject = useMemo(() => {
    return getTemplateSubject(
      selectedTemplate,
      exhibitionName,
    );
  }, [
    selectedTemplate,
    exhibitionName,
  ]);

  const body = useMemo(() => {
    return getTemplateBody(
      selectedTemplate,
      companyName,
    );
  }, [
    selectedTemplate,
    companyName,
  ]);

  const attachments =
    useMemo(() => {
      return getAttachments(
        selectedTemplate,
      );
    }, [selectedTemplate]);

  const communicationHistory =
    useMemo(() => {
      return emails
        .filter(
          (email) =>
            email.company_id === companyId,
        )
        .slice(0, 5);
    }, [
      emails,
      companyId,
    ]);

  function handleTemplateSelect(
    template: string,
  ) {
    setSelectedTemplate(template);
    setSendError(null);
    setSendSuccess(null);
  }

  async function handleSendEmail(
    emailSubject: string,
    emailBody: string,
  ) {
    if (
      sending ||
      !company ||
      !selectedOpportunity
    ) {
      return;
    }

    setSending(true);
    setSendError(null);
    setSendSuccess(null);

    let emailCreated = false;

    try {
      const sentAt =
        new Date().toISOString();

      await createEmail({
        company_id: company.id,
        subject: emailSubject,
        body: emailBody,
        status: "sent",
        sent_at: sentAt,
      });

      emailCreated = true;

      await executeAction({
        actionId:
          mapTemplateToActionId(
            selectedTemplate,
          ),
        title: selectedTemplate,
        companyId: company.id,
        opportunityId:
          selectedOpportunity.id,
      });

      setSendSuccess(
        "E-posta başarıyla kaydedildi. Bir takip hatırlatıcısı oluşturuldu ve fırsat aşaması güncellendi.",
      );
    } catch (sendEmailError) {
      console.error(
        "Email communication error:",
        sendEmailError,
      );

      setSendError(
        emailCreated
          ? "E-posta kaydedildi ancak iş akışı tamamlanamadı. Lütfen tekrar deneyin."
          : "E-posta kaydedilemedi. Lütfen tekrar deneyin.",
      );
    } finally {
      setSending(false);
    }
  }

  return {
    company,
    opportunities,
    emails,
    communicationHistory,
    loading,
    error,
    selectedOpportunity,
    selectedTemplate,
    subject,
    body,
    attachments,
    sending,
    sendError,
    sendSuccess,
    handleTemplateSelect,
    handleSendEmail,
  };
}
