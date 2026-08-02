import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  createEmailForSendOperation,
} from "../../../services/supabase/emailService";
import type { Company, Contact } from "../../../types/database";

import { executeAction } from "../../../features/execution";

import type { RecipientOption } from "../../communication/components/EmailComposer";
import {
  getQuotationEmailBody,
  getTemplateBody,
  getTemplateSubject,
  mapTemplateToActionId,
} from "../../communication/services/templateService";
import type { GeneratedDocumentRecord } from "../../document-engine/models/GeneratedDocumentRecord";
import type { SelectedExhibitionDocument } from "../../exhibitions/models/SelectedExhibitionDocument";

import {
  buildWorkspaceEmailAttachments,
  createWorkspaceEmailSendOperationKey,
  filterRepositoryDocumentsForSession,
  findLatestContractDocument,
  normalizeWorkspaceEmail,
  resolveContractAttachmentForSession,
  resolveQuotationPriceSource,
  shouldTriggerSignatureRequestForEmailEvent,
  validateWorkspaceEmailRecipients,
  WORKSPACE_EMAIL_PATTERN,
} from "../models/exhibitionSessionMail";
import type {
  QuotationPriceSource,
  WorkspaceEmailDraft,
  WorkspaceEmailEvent,
} from "../models/exhibitionSessionMail";
import type { PriceCalculatedMeta } from "../pricing/components/PriceCalculatorModal";
import type { PriceResult } from "../pricing/models/PriceResult";

export const QUOTATION_PRICE_MISSING_MESSAGE =
  "Teklif e-postası hazırlamak için önce bu fuar için fiyat hesaplayın.";

export const WORKSPACE_EMAIL_RECORDED_MESSAGE =
  "E-posta VIAWA yazışma kaydına eklendi. Dış e-posta teslimatı henüz bağlı değildir.";

const EMAIL_SENDER_COMPANY_NAME = "EXPOVIA";

type TemplateContentResult =
  | { ok: true; patch: Partial<WorkspaceEmailDraft> }
  | { ok: false; reason: string };

type TemplateSelectResult =
  | { ok: true }
  | { ok: false; reason: string };

type UseWorkspaceEmailDraftParams = {
  company: Company;
  contacts: Contact[];
  resolvedContact: Contact | null;
  panelSessionExhibitionId: string;
  exhibitionName: string;
  draft: WorkspaceEmailDraft;
  onDraftChange: (patch: Partial<WorkspaceEmailDraft>) => void;
  onEmailEvent: (event: WorkspaceEmailEvent) => void;
  repositoryDocuments: readonly SelectedExhibitionDocument[];
  draftPriceResult: {
    result: PriceResult;
    meta: PriceCalculatedMeta;
  } | null;
  approvedOpportunityPrice: QuotationPriceSource | null;
  /** Applied once, the first time this hook instance mounts — see Section A. */
  requestedTemplateId: string | null;
  /** BUG-S26-002 — source for the "Sözleşme" template's auto-attachment. */
  generatedDocuments: readonly GeneratedDocumentRecord[];
  /** The opportunity this panel's fuar resolves to right now, or null. */
  opportunityId: string | null;
  /**
   * SPRINT 26.2.1 — awaited before a Contract-template send is allowed
   * to write its mail record or report success — see handleSend's
   * Contract branch.
   */
  onSendContractForSignature: (
    record: GeneratedDocumentRecord,
  ) => Promise<
    | { success: true; testMode: boolean }
    | { success: false; message: string }
  >;
};

/**
 * Sprint 25.4B — the Workspace Email Panel's own, ince orkestrasyon layer.
 * Deliberately NOT a variant of useCommunicationWorkspace (that hook is
 * out of scope this sprint — see Kısıtlar): this only reuses the pure,
 * shared pieces (templateService, attachmentService, emailService,
 * recipient validation) and never calls executeAction or touches
 * opportunity/stage/reminder/timeline — those only ever happen inside
 * CustomerWorkspace's Commit Engine, at "Görüşmeyi Tamamla".
 */
export function useWorkspaceEmailDraft({
  company,
  contacts,
  resolvedContact,
  panelSessionExhibitionId,
  exhibitionName,
  draft,
  onDraftChange,
  onEmailEvent,
  repositoryDocuments,
  draftPriceResult,
  approvedOpportunityPrice,
  requestedTemplateId,
  generatedDocuments,
  opportunityId,
  onSendContractForSignature,
}: UseWorkspaceEmailDraftParams) {
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  // BUG-S26.2.8 — TEMPORARY DIAGNOSTIC: the exact inputs this hook
  // instance received on this render — compare panelSessionExhibitionId/
  // opportunityId here against EMAIL PANEL PROPS (CustomerWorkspace.tsx)
  // and GENERATED RECORD CREATED's exhibitionId/opportunityId.
  console.error(
    "[BUG-S26.2.8] EMAIL HOOK INPUT",
    {
      companyId: company.id,
      panelSessionExhibitionId,
      opportunityId,
      templateId: draft.templateId,
      generatedDocumentsCount:
        generatedDocuments.length,
      generatedDocumentsForExhibition:
        generatedDocuments
          .filter(
            (document) =>
              document.exhibitionId ===
              panelSessionExhibitionId,
          )
          .map((document) => ({
            id: document.id,
            status: document.status,
            opportunityId:
              document.opportunityId ??
              null,
            exhibitionId:
              document.exhibitionId,
          })),
    },
  );

  const recipientOptions = useMemo<RecipientOption[]>(
    () =>
      contacts.flatMap((contact) => {
        const email = contact.email?.trim() ?? "";

        if (!WORKSPACE_EMAIL_PATTERN.test(email)) {
          return [];
        }

        const name = [contact.first_name, contact.last_name]
          .filter((part) => Boolean(part?.trim()))
          .join(" ")
          .trim();

        return [
          {
            id: contact.id,
            label: name || email,
            email,
            isPrimary: contact.is_primary,
            isSignatory: contact.is_signatory,
          },
        ];
      }),
    [contacts],
  );

  const resolvedContactHasEmail = Boolean(
    resolvedContact?.email &&
      WORKSPACE_EMAIL_PATTERN.test(resolvedContact.email.trim()),
  );

  // Fuar-scoped: repository selections are live workspace state keyed by
  // whatever the sidebar shows *right now* — while the panel is locked to
  // panelSessionExhibitionId, a fuar switch elsewhere must never leak
  // another fuar's documents into this draft (Section E/H).
  const filteredRepositoryDocuments = useMemo(
    () =>
      filterRepositoryDocumentsForSession(
        repositoryDocuments,
        panelSessionExhibitionId,
      ),
    [repositoryDocuments, panelSessionExhibitionId],
  );

  // Sprint 25.4E — the Exhibition Repository attachment source: the
  // fuar's explicitly checked-off documents, and nothing else. No
  // template placeholders, no Document Basket. See
  // buildWorkspaceEmailAttachments's own doc comment for why
  // buildCommunicationAttachments (Communication Center's helper, left
  // untouched) is deliberately not used here.
  const repositoryAttachments = useMemo(
    () =>
      buildWorkspaceEmailAttachments(filteredRepositoryDocuments),
    [filteredRepositoryDocuments],
  );

  // BUG-S26-002 — the ONLY place the "Sözleşme" template's real contract
  // PDF is resolved: gated on the template actually being selected, so
  // every other template's attachment list is completely unaffected.
  // Prepended (never merged into/replacing) repositoryAttachments, so a
  // manual Repository pick is always preserved alongside it.
  const contractAttachment = useMemo(
    () => {
      if (draft.templateId !== "Contract") {
        return null;
      }

      // BUG-S26.2.8 — TEMPORARY DIAGNOSTIC: findLatestContractDocument
      // is called a second time here purely to observe its result —
      // exhibitionSessionMail.ts's pure functions must stay log-free,
      // so the result is logged at this calling layer instead. This is
      // read-only and has no effect on the real
      // resolveContractAttachmentForSession call below.
      const latestContractDocument =
        findLatestContractDocument(
          generatedDocuments,
          panelSessionExhibitionId,
          opportunityId,
        );

      console.error(
        "[BUG-S26.2.8] LATEST CONTRACT RESULT",
        {
          panelSessionExhibitionId,
          opportunityId,
          generatedDocumentsCount:
            generatedDocuments.length,
          found: Boolean(
            latestContractDocument,
          ),
          record: latestContractDocument
            ? {
                id: latestContractDocument.id,
                status:
                  latestContractDocument.status,
                exhibitionId:
                  latestContractDocument.exhibitionId,
                opportunityId:
                  latestContractDocument.opportunityId ??
                  null,
                version:
                  latestContractDocument.version,
                hasStoragePath: Boolean(
                  latestContractDocument.storagePath,
                ),
                hasPdfDataUrl: Boolean(
                  latestContractDocument.pdfDataUrl,
                ),
              }
            : null,
        },
      );

      const result =
        resolveContractAttachmentForSession(
          generatedDocuments,
          panelSessionExhibitionId,
          opportunityId,
        );

      // BUG-S26.2.8 — TEMPORARY DIAGNOSTIC.
      console.error(
        "[BUG-S26.2.8] CONTRACT ATTACHMENT RESULT",
        {
          found: Boolean(result),
          attachment: result
            ? {
                id: result.id,
                fileName: result.fileName,
              }
            : null,
        },
      );

      return result;
    },
    [
      draft.templateId,
      generatedDocuments,
      panelSessionExhibitionId,
      opportunityId,
    ],
  );

  const attachments = useMemo(
    () =>
      contractAttachment
        ? [contractAttachment, ...repositoryAttachments]
        : repositoryAttachments,
    [contractAttachment, repositoryAttachments],
  );

  // BUG-S26.2.8 — TEMPORARY DIAGNOSTIC: the final merged attachment
  // list handed to the compose UI (contractAttachment + Repository's
  // manually checked-off documents) — the last point in this chain.
  useEffect(() => {
    console.error(
      "[BUG-S26.2.8] FINAL ATTACHMENTS",
      {
        templateId: draft.templateId,
        contractAttachmentPresent: Boolean(
          contractAttachment,
        ),
        repositoryAttachmentsCount:
          repositoryAttachments.length,
        totalAttachmentsCount:
          attachments.length,
        attachmentIds: attachments.map(
          (attachment) => attachment.id,
        ),
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments]);

  // Mirrors the live attachment list into the draft, the same pattern
  // ExhibitionWorkspace already uses to mirror its own checkbox state up
  // into CustomerWorkspace — so the draft always reflects what's actually
  // checked off on the left, and it's still there verbatim if the panel
  // is closed and reopened.
  useEffect(() => {
    onDraftChange({ attachments });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments]);

  // Builds the content patch for a template selection without applying
  // it — kept separate from onDraftChange so both handleTemplateSelect
  // and the post-send reset (which needs to regenerate the *same*
  // template's content fresh, not leave it blank) can reuse this.
  function buildTemplateContent(
    templateId: string,
  ): TemplateContentResult {
    if (templateId === "Quotation") {
      const priceSource = resolveQuotationPriceSource({
        draftPriceResult,
        approvedOpportunityPrice,
      });

      if (!priceSource) {
        return {
          ok: false,
          reason: QUOTATION_PRICE_MISSING_MESSAGE,
        };
      }

      const contactName =
        resolvedContact
          ? [resolvedContact.first_name, resolvedContact.last_name]
              .filter((part) => Boolean(part?.trim()))
              .join(" ")
              .trim() || company.company_name
          : company.company_name;

      return {
        ok: true,
        patch: {
          templateId,
          subject: getTemplateSubject(templateId, exhibitionName),
          body: getQuotationEmailBody({
            contactName,
            exhibitionName,
            standAreaSqm: priceSource.standAreaSqm,
            standType: priceSource.standType,
            currency: priceSource.currency,
            grandTotal: priceSource.grandTotal,
            senderCompanyName: EMAIL_SENDER_COMPANY_NAME,
          }),
          quotationSummaryIncluded: true,
        },
      };
    }

    return {
      ok: true,
      patch: {
        templateId,
        subject: getTemplateSubject(templateId, exhibitionName),
        body: getTemplateBody(templateId, company.company_name),
        quotationSummaryIncluded: false,
      },
    };
  }

  function applyTemplate(templateId: string): TemplateSelectResult {
    const result = buildTemplateContent(templateId);

    if (!result.ok) {
      return result;
    }

    onDraftChange({
      ...result.patch,
      updatedAt: new Date().toISOString(),
    });

    return { ok: true };
  }

  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    // Section D — auto-select the workspace's selected contact, but only
    // into a genuinely empty draft: reopening a draft that already has
    // recipients must never re-inject or duplicate this.
    if (draft.to.length === 0 && resolvedContactHasEmail) {
      onDraftChange({
        to: [normalizeWorkspaceEmail(resolvedContact!.email!)],
      });
    }

    // Section A — an explicit entry point (quick action / proposal-send)
    // always applies its requested template, even onto a reopened draft;
    // the bare "E-posta" button passes null and never overrides an
    // already-drafted template.
    if (
      requestedTemplateId &&
      requestedTemplateId !== draft.templateId
    ) {
      applyTemplate(requestedTemplateId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setToRecipients(recipients: string[]): void {
    onDraftChange({ to: recipients, updatedAt: new Date().toISOString() });
  }

  function setCcRecipients(recipients: string[]): void {
    onDraftChange({ cc: recipients, updatedAt: new Date().toISOString() });
  }

  function setBccRecipients(recipients: string[]): void {
    onDraftChange({ bcc: recipients, updatedAt: new Date().toISOString() });
  }

  function handleTemplateSelect(templateId: string): TemplateSelectResult {
    if (templateId === draft.templateId) {
      return { ok: true };
    }

    const result = applyTemplate(templateId);

    if (!result.ok) {
      setSendError(null);
    }

    return result;
  }

  async function handleSend(
    subject: string,
    body: string,
  ): Promise<boolean> {
    if (sending) {
      return false;
    }

    setSending(true);
    setSendError(null);
    setSendSuccess(null);

    // SPRINT 25.1 — mirrors useCommunicationWorkspace.ts's emailCreated
    // flag: once the emails row exists, a later failure (here, the
    // executeAction workflow chain) must not be reported as a plain
    // "couldn't send" error — see the catch block below.
    let emailRecorded = false;

    try {
      const normalizedSubject = subject.trim();
      const normalizedBody = body.trim();

      if (!normalizedSubject || !normalizedBody) {
        setSendError("Konu ve mesaj alanları zorunludur.");
        return false;
      }

      const normalizedTo = draft.to.map(normalizeWorkspaceEmail);
      const normalizedCc = draft.cc.map(normalizeWorkspaceEmail);
      const normalizedBcc = draft.bcc.map(normalizeWorkspaceEmail);

      const validation = validateWorkspaceEmailRecipients({
        to: normalizedTo,
        cc: normalizedCc,
        bcc: normalizedBcc,
      });

      if (!validation.ok) {
        setSendError(validation.reason);
        return false;
      }

      // SPRINT 26.2.1 — "Sözleşme Gönder" is a real Dropbox Sign
      // signature invitation, not a plain VIAWA mail record. Recipient/
      // form validation above is shared with every other template, but
      // from here on this send takes an entirely separate path: nothing
      // is recorded (no email row, no mail event, no success) until the
      // real signature request has actually succeeded. Every other
      // template (Information Package, Quotation, ...) falls through to
      // the unchanged flow below, completely unaffected.
      if (
        shouldTriggerSignatureRequestForEmailEvent({
          templateId: draft.templateId,
          contractIncluded: Boolean(contractAttachment),
        })
      ) {
        const contractDocument =
          findLatestContractDocument(
            generatedDocuments,
            panelSessionExhibitionId,
            opportunityId,
          );

        if (!contractDocument) {
          setSendError(
            "Gönderilecek gerçek bir sözleşme PDF'i bulunamadı.",
          );

          return false;
        }

        const signatureResult =
          await onSendContractForSignature(
            contractDocument,
          );

        if (!signatureResult.success) {
          setSendError(signatureResult.message);

          return false;
        }

        const recordedAt =
          new Date().toISOString();

        let emailResult;

        try {
          emailResult =
            await createEmailForSendOperation({
              company_id: company.id,
              to_recipients: normalizedTo,
              cc_recipients: normalizedCc,
              bcc_recipients: normalizedBcc,
              subject: normalizedSubject,
              body: normalizedBody,
              status: "sent",
              sent_at: recordedAt,
              send_operation_key:
                draft.sendOperationKey,
            });
        } catch (mailRecordError) {
          // The real, unrepeatable signature request already
          // succeeded — only VIAWA's own mail-record logging failed.
          // A retry is safe: handleSendForSignature's own
          // signatureRequestId guard makes a second "Sözleşme Gönder"
          // click idempotent (no second Dropbox Sign request), so it
          // simply retries writing this record.
          console.error(
            "Contract signature mail record error:",
            mailRecordError,
          );

          setSendError(
            "İmza daveti gönderildi ancak e-posta kaydı oluşturulamadı. Lütfen tekrar deneyin.",
          );

          return false;
        }

        onEmailEvent({
          id: draft.sendOperationKey,
          sendOperationKey:
            draft.sendOperationKey,
          recordedAt,
          to: normalizedTo,
          cc: normalizedCc,
          bcc: normalizedBcc,
          subject: normalizedSubject,
          templateId: draft.templateId,
          attachments: draft.attachments,
          quotationSummaryIncluded:
            draft.quotationSummaryIncluded,
          contractIncluded: true,
          emailRecordId:
            emailResult.email.id,
          deliveryMode: "viawa-record",
          status: emailResult.email.status,
          timelineLinkedAt: null,
        });

        const regeneratedContract =
          buildTemplateContent(
            draft.templateId,
          );

        onDraftChange({
          to: [],
          cc: [],
          bcc: [],
          sendOperationKey:
            createWorkspaceEmailSendOperationKey(),
          updatedAt: recordedAt,
          ...(regeneratedContract.ok
            ? regeneratedContract.patch
            : {}),
        });

        // SPRINT 26.2.2 — test-mode vs production wording, decided
        // entirely by what the Edge Function actually reported (see
        // handleSendContractForSignature/dropboxSignService.ts) — never
        // guessed on the frontend.
        setSendSuccess(
          signatureResult.testMode
            ? "Test imza daveti başarıyla gönderildi. Bu imza hukuken bağlayıcı değildir."
            : "İmza daveti başarıyla gönderildi.",
        );

        return true;
      }

      const recordedAt = new Date().toISOString();

      const emailResult = await createEmailForSendOperation({
        company_id: company.id,
        to_recipients: normalizedTo,
        cc_recipients: normalizedCc,
        bcc_recipients: normalizedBcc,
        subject: normalizedSubject,
        body: normalizedBody,
        status: "sent",
        sent_at: recordedAt,
        send_operation_key: draft.sendOperationKey,
      });

      emailRecorded = true;

      // SPRINT 25.1 — same workflow chain Communication Page's
      // useCommunicationWorkspace.handleSendEmail already triggers after
      // its own email row is created (see executeAction call there):
      // timeline event, opportunity stage, next_action/reminder, AI
      // memory — all still owned by executionListeners.ts, unchanged.
      // Contract is excluded: its signature branch above is a completely
      // separate send path (never reaches this line) and must not also
      // fire this chain a second time. opportunityId is passed through
      // as-is (undefined when this Workspace session has no opportunity
      // yet) — executeAction/executionListeners already treat a missing
      // opportunityId safely (timeline event and a company-level
      // reminder still get created; only the opportunity-specific stage/
      // next_action update is skipped), so no extra guard is needed here.
      await executeAction({
        actionId: mapTemplateToActionId(
          draft.templateId,
        ),
        title: draft.templateId,
        companyId: company.id,
        opportunityId:
          opportunityId ?? undefined,
      });

      onEmailEvent({
        id: draft.sendOperationKey,
        sendOperationKey: draft.sendOperationKey,
        recordedAt,
        to: normalizedTo,
        cc: normalizedCc,
        bcc: normalizedBcc,
        subject: normalizedSubject,
        templateId: draft.templateId,
        attachments: draft.attachments,
        quotationSummaryIncluded: draft.quotationSummaryIncluded,
        contractIncluded: Boolean(contractAttachment),
        emailRecordId: emailResult.email.id,
        deliveryMode: "viawa-record",
        status: emailResult.email.status,
        timelineLinkedAt: null,
      });

      // Section G/K — recipients reset and a fresh sendOperationKey is
      // minted (a genuinely new mail); subject/body are regenerated for
      // the same template rather than left blank, so the template
      // selector and the compose fields never fall out of sync. Nothing
      // here touches mailEvents[]: the event this send just produced
      // stays recorded regardless of what happens to the draft next.
      const regenerated = buildTemplateContent(draft.templateId);

      onDraftChange({
        to: [],
        cc: [],
        bcc: [],
        sendOperationKey: createWorkspaceEmailSendOperationKey(),
        updatedAt: recordedAt,
        ...(regenerated.ok ? regenerated.patch : {}),
      });

      setSendSuccess(WORKSPACE_EMAIL_RECORDED_MESSAGE);
      return true;
    } catch (sendEmailError) {
      console.error(
        "Workspace email send error:",
        sendEmailError,
      );

      setSendError(
        emailRecorded
          ? "E-posta kaydedildi ancak iş akışı tamamlanamadı. Lütfen tekrar deneyin."
          : "E-posta kaydedilemedi. Lütfen tekrar deneyin.",
      );
      return false;
    } finally {
      setSending(false);
    }
  }

  return {
    recipientOptions,
    resolvedContactHasEmail,
    attachments,
    sending,
    sendError,
    sendSuccess,
    setToRecipients,
    setCcRecipients,
    setBccRecipients,
    handleTemplateSelect,
    handleSend,
  };
}
