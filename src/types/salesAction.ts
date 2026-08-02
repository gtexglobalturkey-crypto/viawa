export type OpportunityStage =
  | "new"
  | "contacted"
  | "interested"
  | "information-sent"
  | "quotation-ready"
  | "proposal-ready"
  | "quotation-sent"
  | "negotiation"
  | "contract"
  | "signed"
  | "lost"
  | "won";

export type SalesActionType =
  | "information-package"
  | "quotation"
  | "revised-quotation"
  | "contract"
  | "additional-documents"
  | "follow-up-call"
  | "schedule-meeting"
  | "thank-you";

export type SalesAction = {
  id: string;

  type: SalesActionType;

  title: string;

  description: string;

  recommendedStages: OpportunityStage[];

  createsEmail: boolean;

  createsReminder: boolean;

  updatesTimeline: boolean;

  updatesOpportunity: boolean;

  defaultAttachments: string[];
};