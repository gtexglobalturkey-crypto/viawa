import { executeAction } from "../../../features/execution";
import type { SalesAction } from "../../../types/salesAction";
import { getAttachments } from "../../communication/services/attachmentService";
import {
  getTemplateBody,
  getTemplateSubject,
} from "../../communication/services/templateService";

export type ExecutedSalesAction = {
  actionId: string;
  title: string;

  email: {
    subject: string;
    body: string;
  };

  attachments: string[];

  reminder: {
    enabled: boolean;
    label: string;
  };

  timelineEntry: {
    title: string;
    text: string;
  };

  nextStage: string;

  execution: Awaited<
    ReturnType<typeof executeAction>
  >;
};

export type ExecuteSalesActionInput = {
  action: SalesAction;
  companyId: string;
  companyName: string;
  exhibitionName: string;
  opportunityId?: string | null;
};

function getNextStage(
  actionId: string,
): string {
  switch (actionId) {
    case "information-package":
      return "information-sent";

    case "quotation":
      return "quotation-sent";

    case "revised-quotation":
      return "negotiation";

    case "contract":
      return "contract";

    case "thank-you":
      return "signed";

    default:
      return "contacted";
  }
}

export async function executeSalesAction({
  action,
  companyId,
  companyName,
  exhibitionName,
  opportunityId,
}: ExecuteSalesActionInput): Promise<ExecutedSalesAction> {
  const template = action.title.replace(
    "Send ",
    "",
  );

  const execution = await executeAction({
    actionId: action.id,
    title: action.title,
    companyId,
    opportunityId,
  });

  return {
    actionId: action.id,
    title: action.title,

    email: {
      subject: getTemplateSubject(
        template,
        exhibitionName,
      ),
      body: getTemplateBody(
        template,
        companyName,
      ),
    },

    attachments:
      getAttachments(template),

    reminder: {
      enabled:
        action.createsReminder,
      label:
        action.createsReminder
          ? "Follow-up required"
          : "No reminder",
    },

    timelineEntry: {
      title: action.title,
      text:
        `${action.title} prepared for ${companyName}.`,
    },

    nextStage:
      getNextStage(action.id),

    execution,
  };
}