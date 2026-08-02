import type { OpportunityStage } from "../../../types/salesAction";

export type WorkspaceMode =
  | "manual"
  | "automatic";

export type WorkspaceCustomer = {
  id: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  title: string;
  email: string;
  phone: string;
  isPrimary: boolean;
};

export type WorkspaceCompany = {
  id: string;
  name: string;
  industry: string;
  country: string;
  city: string;
  location: string;
  website: string;
  email: string;
  phone: string;
  notes: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceOpportunity = {
  id: string;
  companyId: string;
  exhibitionId: string | null;

  title: string;

  stage: OpportunityStage;
  stageLabel: string;

  interestLevel: number;
  interestLevelLabel: string;

  estimatedValue: number | null;
  currency: string;
  formattedEstimatedValue: string;
  standTypeLabel: string;
  priceCalculatedAt: string | null;
  priceCalculatedDateLabel: string;
  quotationSent: boolean;

  probability: number | null;
  probabilityLabel: string;

  nextAction: string;
  nextActionAt: string | null;
  nextActionDateLabel: string;

  lastContactAt: string | null;
  lastContactDateLabel: string;

  owner: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceExhibition = {
  id: string | null;
  name: string;
  organizer?: string;
  hall: string;
  booth: string;

  standSizeSqm: number | null;
  standSizeLabel: string;

  floorPlanStatus: string;
  quotationStatus: string;
};

export type WorkspaceTask = {
  id: string;
  title: string;
  description: string;

  dueAt: string | null;
  dueDateLabel: string;

  priority:
    | "low"
    | "medium"
    | "high"
    | "urgent";

  status:
    | "pending"
    | "completed"
    | "cancelled";
};

export type WorkspaceReminder = {
  id: string;
  title: string;
  description: string;

  remindAt: string | null;
  remindDateLabel: string;

  completed: boolean;
};

export type WorkspaceTimelineItem = {
  id: string;
  icon: string;

  type: string;
  title: string;
  text: string;

  createdAt: string;
  dateLabel: string;
};

export type WorkspaceConversationSource =
  | "timeline"
  | "call-note"
  | "email"
  | "reminder"
  | "ai-memory";

export type WorkspaceConversationItem = {
  id: string;
  source: WorkspaceConversationSource;

  icon: string;
  type: string;

  title: string;
  text: string;

  createdAt: string;
  dateLabel: string;
};

export type WorkspaceConversationMetrics = {
  totalItems: number;

  timelineCount: number;
  callNoteCount: number;
  emailCount: number;
  reminderCount: number;
  aiMemoryCount: number;

  lastActivityAt: string | null;
  lastActivityDateLabel: string;

  daysSinceLastActivity: number | null;

  unansweredEmailCount: number;
  pendingReminderCount: number;
  overdueReminderCount: number;

  followUpOverdue: boolean;

  activityScore: number;
  activityScoreLabel: string;

  riskScore: number;
  riskScoreLabel: string;
};

export type WorkspaceAiMemory = {
  id: string;

  category:
    | "general"
    | "customer-preference"
    | "objection"
    | "pricing"
    | "commitment"
    | "next-step";

  categoryLabel: string;

  content: string;
  importance: number;

  createdAt: string;
  dateLabel: string;
};

export type WorkspaceAi = {
  confidence: number;
  confidenceLabel: string;

  conversationSummary: string;
  latestMemory: string;

  riskAnalysis: string;
  nextBestAction: string;

  memories: WorkspaceAiMemory[];

  createdAt: string | null;
  updatedAt: string | null;
};

export type WorkspaceSession = {
  status:
    | "active"
    | "completed";

  statusLabel: string;
  notes: string;
};

export type CallWorkspaceViewModel = {
  company: WorkspaceCompany;
  customer: WorkspaceCustomer;
  opportunity: WorkspaceOpportunity;
  exhibition: WorkspaceExhibition;

  tasks: WorkspaceTask[];
  reminders: WorkspaceReminder[];

  timeline: WorkspaceTimelineItem[];

  conversationHistory:
    WorkspaceConversationItem[];

  conversationMetrics?:
    WorkspaceConversationMetrics;

  ai: WorkspaceAi;
  session: WorkspaceSession;
};
