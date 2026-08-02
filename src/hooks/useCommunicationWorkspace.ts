import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useToast } from "../components/feedback/toastContext";

import {
  createEmailForSendOperation,
  updateEmail,
} from "../services/supabase/emailService";
import { getOpportunity } from "../services/supabase/opportunityService";

import { executeAction } from "../features/execution";

import { useWorkspaceData } from "../modules/call-workspace/hooks/useWorkspaceData";

import { buildCommunicationAttachments } from "../modules/communication/services/attachmentService";

import {
  getQuotationEmailBody,
  getTemplateBody,
  getTemplateSubject,
  mapTemplateToActionId,
} from "../modules/communication/services/templateService";

import type { SelectedDocumentBasketItem } from "../modules/call-workspace/document-basket";
import type { SelectedExhibitionDocument } from "../modules/exhibitions/models/SelectedExhibitionDocument";
import type { RecipientOption } from "../modules/communication/components/EmailComposer";
import {
  getBusinessStatusLabel,
  isForwardStageTransition,
} from "../types/businessStatus";

export type CommunicationContext = {
  company: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
    website: string | null;
    taxOffice: string | null;
    taxNumber: string | null;
  };
  opportunity: {
    id: string;
    stage: string;
    standType: string | null;
    areaSqm: number | null;
    currency: string | null;
    grandTotal: number | null;
  } | null;
  exhibition: {
    id: string;
    name: string;
    startDate: string | null;
    endDate: string | null;
    city: string | null;
    country: string | null;
  } | null;
  primaryContact: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
  } | null;
  signatoryContact: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
  } | null;
};

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function createSendOperationKey(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `quotation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const STAND_TYPE_LABELS: Record<string, string> = {
  "space-only": "Space Only",
  "shell-scheme": "Shell Scheme",
  "premium-shell": "Premium Shell",
  custom: "Custom Stand",
  outdoor: "Outdoor",
};

type UseCommunicationWorkspaceParams = {
  companyId?: string;
  opportunityId?: string | null;
  selectedContactId?: string | null;
  initialTemplate: string;
  documentBasketItems?: SelectedDocumentBasketItem[];
  exhibitionDocuments?: SelectedExhibitionDocument[];
};

export type QuotationSendCompletion = {
  emailId: string;
  sentAt: string;
  companyId: string;
  opportunityId: string;
};

export function useCommunicationWorkspace({
  companyId,
  opportunityId,
  selectedContactId,
  initialTemplate,
  documentBasketItems = [],
  exhibitionDocuments = [],
}: UseCommunicationWorkspaceParams) {
  const {
    company,
    opportunities,
    emails,
    exhibitions,
    contacts,
    loading,
    error: workspaceError,
    refresh,
  } = useWorkspaceData(companyId);

  const { showToast } = useToast();

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

  const [
    toRecipients,
    setToRecipients,
  ] = useState<string[]>([]);

  const [
    ccRecipients,
    setCcRecipients,
  ] = useState<string[]>([]);

  const [
    bccRecipients,
    setBccRecipients,
  ] = useState<string[]>([]);

  const initializedRecipientContextRef =
    useRef<string | null>(null);
  const sendOperationKeyRef =
    useRef(createSendOperationKey());

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
        ) ?? null
      );
    }, [
      opportunities,
      opportunityId,
    ]);

  const companyName =
    company?.company_name ?? "";

  const linkedExhibition = useMemo(() => {
    if (!selectedOpportunity?.exhibition_id) {
      return null;
    }

    return (
      exhibitions.find(
        (exhibition) =>
          exhibition.id ===
          selectedOpportunity.exhibition_id,
      ) ?? null
    );
  }, [
    exhibitions,
    selectedOpportunity,
  ]);

  const exhibitionName = selectedOpportunity
    ? (linkedExhibition?.name ?? "Fuar Katılımı")
    : "";

  function getContactFullName(
    contact: typeof contacts[number],
  ): string {
    return [
      contact.first_name,
      contact.last_name,
    ]
      .filter((part) => Boolean(part?.trim()))
      .join(" ")
      .trim();
  }

  const communicationContext =
    useMemo<CommunicationContext | null>(() => {
      if (!company) {
        return null;
      }

      const primaryContact =
        contacts.find((contact) => contact.is_primary) ??
        null;
      const signatoryContact =
        contacts.find((contact) => contact.is_signatory) ??
        null;

      function mapContact(
        contact: typeof contacts[number] | null,
      ) {
        return contact
          ? {
              id: contact.id,
              fullName:
                getContactFullName(contact) || "—",
              email: contact.email,
              phone: contact.phone,
            }
          : null;
      }

      return {
        company: {
          id: company.id,
          name: company.company_name,
          phone: company.phone,
          email: company.email,
          address: company.address ?? null,
          city: company.city ?? null,
          country: company.country,
          website: company.website,
          taxOffice: company.tax_office ?? null,
          taxNumber: company.tax_number ?? null,
        },
        opportunity: selectedOpportunity
          ? {
              id: selectedOpportunity.id,
              stage:
                getBusinessStatusLabel(
                  selectedOpportunity.stage,
                ) ?? selectedOpportunity.stage,
              standType:
                selectedOpportunity.price_stand_type ??
                null,
              areaSqm:
                selectedOpportunity.price_stand_area_sqm ??
                null,
              currency:
                selectedOpportunity.price_currency ??
                null,
              grandTotal:
                selectedOpportunity.price_grand_total ??
                null,
            }
          : null,
        exhibition: linkedExhibition
          ? {
              id: linkedExhibition.id,
              name: linkedExhibition.name,
              startDate: linkedExhibition.start_date,
              endDate: linkedExhibition.end_date,
              city: linkedExhibition.city,
              country: linkedExhibition.country,
            }
          : null,
        primaryContact:
          mapContact(primaryContact),
        signatoryContact:
          mapContact(signatoryContact),
      };
    }, [
      company,
      contacts,
      linkedExhibition,
      selectedOpportunity,
    ]);

  const opportunityContextError =
    opportunityId &&
    !loading &&
    !workspaceError &&
    !selectedOpportunity
      ? "Belirtilen fırsat bu firmaya ait değil veya bulunamadı."
      : null;

  // "Ana İletişim Kişisi" (Contact.is_primary) — same role already used
  // elsewhere for the exhibition/main contact (see Contact in
  // types/database.ts). Falls back to the company name when no primary
  // contact is on file, same as every other template's salutation.
  const primaryContactName = useMemo(() => {
    const primaryContact = contacts.find(
      (contact) => contact.is_primary,
    );

    const fullName = [
      primaryContact?.first_name,
      primaryContact?.last_name,
    ]
      .filter((part) =>
        Boolean(part?.trim()),
      )
      .join(" ")
      .trim();

    return fullName || companyName;
  }, [contacts, companyName]);

  const recipientOptions = useMemo<
    RecipientOption[]
  >(() =>
    contacts.flatMap((contact) => {
      const email = contact.email?.trim() ?? "";

      if (!EMAIL_PATTERN.test(email)) {
        return [];
      }

      const name = [
        contact.first_name,
        contact.last_name,
      ]
        .filter((part) => Boolean(part?.trim()))
        .join(" ")
        .trim();

      return [{
        id: contact.id,
        label: name || email,
        email,
        isPrimary: contact.is_primary,
        isSignatory: contact.is_signatory,
      }];
    }),
  [contacts]);

  useEffect(() => {
    if (loading) {
      return;
    }

    const contextKey = [
      companyId ?? "",
      selectedContactId ?? "",
    ].join(":");

    if (
      initializedRecipientContextRef.current ===
      contextKey
    ) {
      return;
    }

    const explicitlySelectedContact =
      selectedContactId
        ? recipientOptions.find(
            (option) =>
              option.id === selectedContactId,
          )
        : undefined;

    setToRecipients(
      explicitlySelectedContact
        ? [normalizeEmail(
            explicitlySelectedContact.email,
          )]
        : [],
    );
    setCcRecipients([]);
    setBccRecipients([]);

    initializedRecipientContextRef.current =
      contextKey;
  }, [
    companyId,
    loading,
    recipientOptions,
    selectedContactId,
  ]);

  // The approved price already persisted onto the Opportunity (Sprint
  // 22.4/22.9.1's price_* columns) — the "approved price snapshot" this
  // sprint reuses rather than introducing a new proposal document.
  const hasApprovedQuotationPricing =
    selectedOpportunity?.price_grand_total !=
      null &&
    selectedOpportunity.price_currency !=
      null &&
    selectedOpportunity.price_stand_area_sqm !=
      null &&
    selectedOpportunity.price_stand_type !=
      null;

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
    if (
      selectedTemplate === "Quotation" &&
      selectedOpportunity &&
      hasApprovedQuotationPricing
    ) {
      return getQuotationEmailBody({
        contactName: primaryContactName,
        exhibitionName,
        standAreaSqm:
          selectedOpportunity.price_stand_area_sqm as number,
        standType:
          selectedOpportunity.price_stand_type as string,
        currency:
          selectedOpportunity.price_currency as string,
        grandTotal:
          selectedOpportunity.price_grand_total as number,
        senderCompanyName: "EXPOVIA",
      });
    }

    return getTemplateBody(
      selectedTemplate,
      companyName,
    );
  }, [
    selectedTemplate,
    selectedOpportunity,
    hasApprovedQuotationPricing,
    primaryContactName,
    exhibitionName,
    companyName,
  ]);

  const attachments =
    useMemo(() => {
      return buildCommunicationAttachments(
        selectedTemplate,
        documentBasketItems,
        exhibitionDocuments,
      );
    }, [
      selectedTemplate,
      documentBasketItems,
      exhibitionDocuments,
    ]);

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
    if (
      template === "Quotation" &&
      !hasApprovedQuotationPricing
    ) {
      showToast(
        "Teklif oluşturmak için önce fiyatı onaylayın.",
        "error",
      );

      return;
    }

    setSelectedTemplate(template);
    setSendError(null);
    setSendSuccess(null);
  }

  async function handleSendEmail(
    emailSubject: string,
    emailBody: string,
  ): Promise<QuotationSendCompletion | null> {
    if (
      sending ||
      !company ||
      !selectedOpportunity
    ) {
      return null;
    }

    setSending(true);
    setSendError(null);
    setSendSuccess(null);

    let emailCreated = false;

    try {
      const normalizedSubject =
        emailSubject.trim();
      const normalizedBody =
        emailBody.trim();

      if (!normalizedSubject || !normalizedBody) {
        setSendError(
          "Konu ve mesaj alanları zorunludur.",
        );

        return null;
      }

      const sentAt =
        new Date().toISOString();

      const normalizedToRecipients =
        toRecipients.map(normalizeEmail);
      const normalizedCcRecipients =
        ccRecipients.map(normalizeEmail);
      const normalizedBccRecipients =
        bccRecipients.map(normalizeEmail);

      if (normalizedToRecipients.length === 0) {
        setSendError(
          "Göndermek için en az bir geçerli TO alıcısı seçin.",
        );

        return null;
      }

      const allRecipients = [
        ...normalizedToRecipients,
        ...normalizedCcRecipients,
        ...normalizedBccRecipients,
      ];

      if (
        allRecipients.some(
          (email) => !EMAIL_PATTERN.test(email),
        )
      ) {
        setSendError(
          "Alıcı e-posta adreslerinden biri geçersiz.",
        );

        return null;
      }

      if (
        new Set(allRecipients).size !==
        allRecipients.length
      ) {
        setSendError(
          "Aynı e-posta adresi TO, CC veya BCC alanlarında birden fazla kez kullanılamaz.",
        );

        return null;
      }

      const emailResult =
        await createEmailForSendOperation({
        company_id: company.id,
        to_recipients: normalizedToRecipients,
        cc_recipients: normalizedCcRecipients,
        bcc_recipients: normalizedBccRecipients,
        subject: normalizedSubject,
        body: normalizedBody,
        status: "sending",
        sent_at: null,
        send_operation_key:
          sendOperationKeyRef.current,
      });

      emailCreated = true;

      if (
        !emailResult.created &&
        emailResult.email.status === "sent"
      ) {
        return {
          emailId: emailResult.email.id,
          sentAt:
            emailResult.email.sent_at ?? sentAt,
          companyId: company.id,
          opportunityId: selectedOpportunity.id,
        };
      }

      const quotationDescription =
        selectedTemplate === "Quotation"
          ? [
              [
                exhibitionName || null,
                selectedOpportunity.price_stand_area_sqm != null
                  ? `${selectedOpportunity.price_stand_area_sqm} m²`
                  : null,
                selectedOpportunity.price_stand_type
                  ? (STAND_TYPE_LABELS[
                      selectedOpportunity.price_stand_type
                    ] ?? selectedOpportunity.price_stand_type)
                  : null,
                selectedOpportunity.price_grand_total != null
                  ? `${new Intl.NumberFormat("tr-TR", {
                      maximumFractionDigits: 2,
                    }).format(selectedOpportunity.price_grand_total)} ${selectedOpportunity.price_currency ?? ""}`.trim()
                  : null,
              ]
                .filter(Boolean)
                .join(" • "),
              `Alıcı: ${normalizedToRecipients.join(", ")}`,
            ]
              .filter(Boolean)
              .join("\n")
          : null;

      await executeAction({
        actionId:
          mapTemplateToActionId(
            selectedTemplate,
          ),
        title: selectedTemplate,
        companyId: company.id,
        opportunityId:
          selectedOpportunity.id,
        description: quotationDescription,
      });

      // Sprint 22.9.5 — the "quotation" actionId above already runs
      // through the shared execution pipeline (executeAction →
      // publish → executionListeners' single subscriber), which calls
      // updateOpportunity(..., { stage: "quotation-sent" }) itself
      // (see getNextStage/buildOpportunityUpdate in
      // executionListeners.ts, via the "quotation" →
      // resultingStage: "quotation-sent" mapping in
      // types/workspaceFollowUpAction.ts). That whole chain is awaited
      // (eventBus.publish does `await Promise.all(...)`, and
      // executeAction awaits publish), so executeAction only resolves
      // once the stage write itself has completed — this IS the one
      // authoritative, awaited stage-write path; a second, direct
      // updateOpportunity call here would just be a redundant duplicate
      // of the same write and has been removed.
      if (selectedTemplate === "Quotation") {
        await refresh();

        const confirmedOpportunity =
          await getOpportunity(
            selectedOpportunity.id,
          );

        if (
          !confirmedOpportunity ||
          !isForwardStageTransition(
            "quotation-sent",
            confirmedOpportunity.stage,
          ) ||
          !confirmedOpportunity.next_action?.trim() ||
          !confirmedOpportunity.next_action_date
        ) {
          throw new Error(
            "Teklif iş akışı veritabanında doğrulanamadı.",
          );
        }

        setSendSuccess(
          'Teklif kaydedildi ve fırsat aşaması "Teklif Gönderildi" olarak güncellendi.',
        );
      } else {
        setSendSuccess(
          "E-posta başarıyla kaydedildi. Bir takip hatırlatıcısı oluşturuldu ve fırsat aşaması güncellendi.",
        );
      }

      const completedEmail = await updateEmail(
        emailResult.email.id,
        {
          status: "sent",
          sent_at: sentAt,
        },
      );


      return selectedTemplate === "Quotation"
        ? {
            emailId: completedEmail.id,
            sentAt: completedEmail.sent_at ?? sentAt,
            companyId: company.id,
            opportunityId: selectedOpportunity.id,
          }
        : null;
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

      return null;
    } finally {
      setSending(false);
    }
  }

  return {
    company,
    opportunities,
    emails,
    communicationHistory,
    communicationContext,
    loading,
    error:
      workspaceError ?? opportunityContextError,
    selectedOpportunity,
    selectedTemplate,
    subject,
    body,
    attachments,
    recipientOptions,
    toRecipients,
    ccRecipients,
    bccRecipients,
    sending,
    sendError,
    sendSuccess,
    handleTemplateSelect,
    handleSendEmail,
    setToRecipients,
    setCcRecipients,
    setBccRecipients,
  };
}
