import type { CrmState } from "./crmTypes";

const now = new Date();

function isoDate(daysFromNow: number, hour = 10) {
  const date = new Date(now);

  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hour, 0, 0, 0);

  return date.toISOString();
}

export const crmSeedData: CrmState = {
  companies: [
    {
      id: "company-atlas-mining",
      name: "Atlas Mining",
      industry: "Mining",
      country: "Türkiye",
      city: "Ankara",
      website: "https://atlasmining.example.com",
      phone: "+90 312 555 24 10",
      email: "info@atlasmining.example.com",
      notes:
        "International exhibition participation potential is high. The company is evaluating expansion into foreign markets.",
      contactIds: ["contact-mehmet-kaya"],
      opportunityIds: ["opportunity-atlas-mining-expo"],
      createdAt: isoDate(-30),
      updatedAt: isoDate(-1),
    },
    {
      id: "company-mks-machinery",
      name: "MKS Machinery",
      industry: "Mining Machinery",
      country: "Türkiye",
      city: "İstanbul",
      website: "https://mksmachinery.example.com",
      phone: "+90 212 555 18 40",
      email: "sales@mksmachinery.example.com",
      notes:
        "Requested exhibition pricing and stand alternatives.",
      contactIds: ["contact-selin-demir"],
      opportunityIds: ["opportunity-mks-machinery-expo"],
      createdAt: isoDate(-20),
      updatedAt: isoDate(-2),
    },
    {
      id: "company-geotech",
      name: "GeoTech",
      industry: "Geotechnical Solutions",
      country: "Türkiye",
      city: "İzmir",
      website: "https://geotech.example.com",
      phone: "+90 232 555 44 50",
      email: "export@geotech.example.com",
      notes:
        "Previous calls were unanswered. A new follow-up call is required.",
      contactIds: ["contact-burak-arslan"],
      opportunityIds: ["opportunity-geotech-expo"],
      createdAt: isoDate(-12),
      updatedAt: isoDate(-3),
    },
  ],

  contacts: [
    {
      id: "contact-mehmet-kaya",
      companyId: "company-atlas-mining",
      firstName: "Mehmet",
      lastName: "Kaya",
      title: "Purchasing Director",
      email: "mehmet.kaya@atlasmining.example.com",
      phone: "+90 532 555 11 20",
      isPrimary: true,
    },
    {
      id: "contact-selin-demir",
      companyId: "company-mks-machinery",
      firstName: "Selin",
      lastName: "Demir",
      title: "Export Manager",
      email: "selin.demir@mksmachinery.example.com",
      phone: "+90 533 555 31 45",
      isPrimary: true,
    },
    {
      id: "contact-burak-arslan",
      companyId: "company-geotech",
      firstName: "Burak",
      lastName: "Arslan",
      title: "General Manager",
      email: "burak.arslan@geotech.example.com",
      phone: "+90 534 555 62 80",
      isPrimary: true,
    },
  ],

  opportunities: [
    {
      id: "opportunity-atlas-mining-expo",
      companyId: "company-atlas-mining",
      exhibitionId: "exhibition-global-mining-2026",
      title: "Global Mining Expo 2026 Participation",
      stage: "information-sent",
      estimatedValue: 42000,
      currency: "EUR",
      probability: 72,
      assignedUserId: "user-ahmet",
      nextAction: "Follow-up call",
      nextActionAt: isoDate(1, 10),
      lastContactAt: isoDate(-1, 14),
      createdAt: isoDate(-25),
      updatedAt: isoDate(-1),
    },
    {
      id: "opportunity-mks-machinery-expo",
      companyId: "company-mks-machinery",
      exhibitionId: "exhibition-global-mining-2026",
      title: "Global Mining Expo 2026 Participation",
      stage: "quotation-requested",
      estimatedValue: 28000,
      currency: "EUR",
      probability: 60,
      assignedUserId: "user-ahmet",
      nextAction: "Prepare price quotation",
      nextActionAt: isoDate(0, 16),
      lastContactAt: isoDate(-2, 11),
      createdAt: isoDate(-18),
      updatedAt: isoDate(-2),
    },
    {
      id: "opportunity-geotech-expo",
      companyId: "company-geotech",
      exhibitionId: "exhibition-global-mining-2026",
      title: "Global Mining Expo 2026 Participation",
      stage: "contacted",
      estimatedValue: 18000,
      currency: "EUR",
      probability: 35,
      assignedUserId: "user-ahmet",
      nextAction: "Call again",
      nextActionAt: isoDate(0, 14),
      lastContactAt: isoDate(-3, 15),
      createdAt: isoDate(-10),
      updatedAt: isoDate(-3),
    },
  ],

  timelineEvents: [
    {
      id: "timeline-atlas-information-sent",
      companyId: "company-atlas-mining",
      opportunityId: "opportunity-atlas-mining-expo",
      type: "information-sent",
      title: "Information package sent",
      description:
        "Floor plan, price list and participation services were sent by email.",
      createdBy: "user-ahmet",
      createdAt: isoDate(-1, 14),
      metadata: {
        channel: "email",
        attachments: [
          "floor-plan.pdf",
          "price-list.pdf",
          "services.pdf",
        ],
      },
    },
    {
      id: "timeline-atlas-call",
      companyId: "company-atlas-mining",
      opportunityId: "opportunity-atlas-mining-expo",
      type: "call",
      title: "Customer call completed",
      description:
        "Mehmet Kaya requested exhibition details and pricing.",
      createdBy: "user-ahmet",
      createdAt: isoDate(-2, 11),
    },
    {
      id: "timeline-atlas-company-created",
      companyId: "company-atlas-mining",
      opportunityId: "opportunity-atlas-mining-expo",
      type: "company-created",
      title: "Company record created",
      description: "Atlas Mining was added to Atlas CRM.",
      createdBy: "user-ahmet",
      createdAt: isoDate(-30, 9),
    },
    {
      id: "timeline-mks-quotation-requested",
      companyId: "company-mks-machinery",
      opportunityId: "opportunity-mks-machinery-expo",
      type: "call",
      title: "Quotation requested",
      description:
        "Customer requested pricing for a 24 m² corner stand.",
      createdBy: "user-ahmet",
      createdAt: isoDate(-2, 11),
      metadata: {
        standSizeSqm: 24,
        locationType: "corner",
      },
    },
    {
      id: "timeline-geotech-call",
      companyId: "company-geotech",
      opportunityId: "opportunity-geotech-expo",
      type: "call",
      title: "Call unanswered",
      description:
        "The decision maker could not be reached. Another call was planned.",
      createdBy: "user-ahmet",
      createdAt: isoDate(-3, 15),
    },
  ],

  tasks: [
    {
      id: "task-atlas-follow-up",
      companyId: "company-atlas-mining",
      opportunityId: "opportunity-atlas-mining-expo",
      title: "Call Atlas Mining",
      description:
        "Confirm whether the information package was reviewed.",
      dueAt: isoDate(1, 10),
      status: "pending",
      priority: "high",
      createdAt: isoDate(-1, 14),
    },
    {
      id: "task-mks-quotation",
      companyId: "company-mks-machinery",
      opportunityId: "opportunity-mks-machinery-expo",
      title: "Prepare MKS Machinery quotation",
      description:
        "Prepare pricing for a 24 m² corner stand.",
      dueAt: isoDate(0, 16),
      status: "pending",
      priority: "urgent",
      createdAt: isoDate(-2, 11),
    },
    {
      id: "task-geotech-call",
      companyId: "company-geotech",
      opportunityId: "opportunity-geotech-expo",
      title: "Call GeoTech again",
      description:
        "Try to reach the general manager before the end of the day.",
      dueAt: isoDate(0, 14),
      status: "pending",
      priority: "medium",
      createdAt: isoDate(-3, 15),
    },
  ],

  emails: [
    {
      id: "email-atlas-information-package",
      companyId: "company-atlas-mining",
      opportunityId: "opportunity-atlas-mining-expo",
      contactId: "contact-mehmet-kaya",
      to: ["mehmet.kaya@atlasmining.example.com"],
      subject: "Global Mining Expo 2026 Participation Information",
      body:
        "Dear Mr. Kaya,\n\nPlease find attached the exhibition floor plan, price list and participation services.\n\nBest regards,\nER Expo",
      attachmentIds: [
        "attachment-floor-plan",
        "attachment-price-list",
        "attachment-services",
      ],
      status: "sent",
      createdAt: isoDate(-1, 14),
      sentAt: isoDate(-1, 14),
    },
    {
      id: "email-mks-quotation-draft",
      companyId: "company-mks-machinery",
      opportunityId: "opportunity-mks-machinery-expo",
      contactId: "contact-selin-demir",
      to: ["selin.demir@mksmachinery.example.com"],
      subject: "Global Mining Expo 2026 Quotation",
      body:
        "Dear Ms. Demir,\n\nPlease find our participation quotation below.\n\nBest regards,\nER Expo",
      attachmentIds: [],
      status: "draft",
      createdAt: isoDate(0, 9),
    },
  ],

  reminders: [
    {
      id: "reminder-atlas-follow-up",
      companyId: "company-atlas-mining",
      opportunityId: "opportunity-atlas-mining-expo",
      title: "Atlas Mining follow-up",
      description:
        "Ask whether the information package was reviewed.",
      remindAt: isoDate(1, 9),
      status: "pending",
      createdAt: isoDate(-1, 14),
    },
    {
      id: "reminder-geotech-call",
      companyId: "company-geotech",
      opportunityId: "opportunity-geotech-expo",
      title: "Call GeoTech",
      description:
        "Try to reach Burak Arslan regarding exhibition participation.",
      remindAt: isoDate(0, 14),
      status: "pending",
      createdAt: isoDate(-3, 15),
    },
  ],

  aiMemories: [
    {
      id: "memory-atlas-interest",
      companyId: "company-atlas-mining",
      opportunityId: "opportunity-atlas-mining-expo",
      category: "customer-preference",
      content:
        "The customer is interested in a visible stand location near the main visitor route.",
      importance: 9,
      sourceTimelineEventId: "timeline-atlas-call",
      createdAt: isoDate(-2, 11),
      updatedAt: isoDate(-2, 11),
    },
    {
      id: "memory-atlas-pricing",
      companyId: "company-atlas-mining",
      opportunityId: "opportunity-atlas-mining-expo",
      category: "pricing",
      content:
        "The customer wants to review the total cost before discussing management approval.",
      importance: 8,
      sourceTimelineEventId: "timeline-atlas-call",
      createdAt: isoDate(-2, 11),
      updatedAt: isoDate(-2, 11),
    },
    {
      id: "memory-atlas-next-step",
      companyId: "company-atlas-mining",
      opportunityId: "opportunity-atlas-mining-expo",
      category: "next-step",
      content:
        "Follow up after the information package has been reviewed.",
      importance: 10,
      sourceTimelineEventId:
        "timeline-atlas-information-sent",
      createdAt: isoDate(-1, 14),
      updatedAt: isoDate(-1, 14),
    },
    {
      id: "memory-mks-stand",
      companyId: "company-mks-machinery",
      opportunityId: "opportunity-mks-machinery-expo",
      category: "customer-preference",
      content:
        "The customer requested a 24 m² corner stand.",
      importance: 9,
      sourceTimelineEventId:
        "timeline-mks-quotation-requested",
      createdAt: isoDate(-2, 11),
      updatedAt: isoDate(-2, 11),
    },
  ],

  selectedCompanyId: "company-atlas-mining",
  selectedOpportunityId: "opportunity-atlas-mining-expo",
};