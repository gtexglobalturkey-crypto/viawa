import { SalesAction } from "../../types/salesAction";

export const salesActions: SalesAction[] = [
  {
    id: "information-package",

    type: "information-package",

    title: "Send Information Package",

    description:
      "Send exhibition information package including floor plan, price list and services.",

    recommendedStages: [
      "contacted",
      "interested",
    ],

    createsEmail: true,

    createsReminder: true,

    updatesTimeline: true,

    updatesOpportunity: true,

    defaultAttachments: [
      "Floor Plan",
      "Price List",
      "Services",
    ],
  },

  {
    id: "quotation",

    type: "quotation",

    title: "Send Quotation",

    description:
      "Prepare and send participation quotation.",

    recommendedStages: [
      "quotation-ready",
    ],

    createsEmail: true,

    createsReminder: true,

    updatesTimeline: true,

    updatesOpportunity: true,

    defaultAttachments: [
      "Quotation",
      "Floor Plan",
    ],
  },

  {
    id: "revised-quotation",

    type: "revised-quotation",

    title: "Send Revised Quotation",

    description:
      "Send updated quotation after negotiation.",

    recommendedStages: [
      "negotiation",
    ],

    createsEmail: true,

    createsReminder: true,

    updatesTimeline: true,

    updatesOpportunity: true,

    defaultAttachments: [
      "Updated Quotation",
      "Updated Floor Plan",
    ],
  },

  {
    id: "contract",

    type: "contract",

    title: "Send Contract",

    description:
      "Send participation contract for signature.",

    recommendedStages: [
      "contract",
    ],

    createsEmail: true,

    createsReminder: true,

    updatesTimeline: true,

    updatesOpportunity: true,

    defaultAttachments: [
      "Contract",
    ],
  },

  {
    id: "follow-up-call",

    type: "follow-up-call",

    title: "Schedule Follow-up Call",

    description:
      "Plan the next follow-up call.",

    recommendedStages: [
      "information-sent",
      "quotation-sent",
      "negotiation",
    ],

    createsEmail: false,

    createsReminder: true,

    updatesTimeline: true,

    updatesOpportunity: false,

    defaultAttachments: [],
  },

  {
    id: "schedule-meeting",

    type: "schedule-meeting",

    title: "Schedule Meeting",

    description:
      "Arrange an online or face-to-face meeting.",

    recommendedStages: [
      "interested",
      "quotation-ready",
    ],

    createsEmail: true,

    createsReminder: true,

    updatesTimeline: true,

    updatesOpportunity: false,

    defaultAttachments: [],
  },

  {
    id: "additional-documents",

    type: "additional-documents",

    title: "Send Additional Documents",

    description:
      "Send extra requested documents.",

    recommendedStages: [
      "negotiation",
      "quotation-ready",
    ],

    createsEmail: true,

    createsReminder: false,

    updatesTimeline: true,

    updatesOpportunity: false,

    defaultAttachments: [],
  },

  {
    id: "thank-you",

    type: "thank-you",

    title: "Send Thank You",

    description:
      "Send thank you message after successful participation.",

    recommendedStages: [
      "signed",
    ],

    createsEmail: true,

    createsReminder: false,

    updatesTimeline: true,

    updatesOpportunity: false,

    defaultAttachments: [],
  },
];