export type OpportunityStage =
  | "new"
  | "contacted"
  | "interested"
  | "information-sent"
  | "quotation-requested"
  | "quotation-sent"
  | "negotiation"
  | "contract"
  | "signed"
  | "lost";

export type TimelineEventType =
  | "company-created"
  | "call"
  | "email"
  | "information-sent"
  | "quotation-created"
  | "quotation-sent"
  | "meeting"
  | "note"
  | "reminder-created"
  | "contract-sent"
  | "contract-signed"
  | "stage-changed";

export type TaskStatus = "pending" | "completed" | "cancelled";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type EmailStatus =
  | "draft"
  | "scheduled"
  | "sent"
  | "opened"
  | "replied";

export type ReminderStatus = "pending" | "completed" | "cancelled";

export type Contact = {
  id: string;

  companyId: string;

  firstName: string;

  lastName: string;

  title?: string;

  email?: string;

  phone?: string;

  isPrimary: boolean;
};

export type Company = {
  id: string;

  name: string;

  industry?: string;

  country?: string;

  city?: string;

  website?: string;

  phone?: string;

  email?: string;

  notes?: string;

  contactIds: string[];

  opportunityIds: string[];

  createdAt: string;

  updatedAt: string;
};

export type Opportunity = {
  id: string;

  companyId: string;

  exhibitionId?: string;

  title: string;

  stage: OpportunityStage;

  estimatedValue?: number;

  currency?: string;

  probability?: number;

  assignedUserId?: string;

  nextAction?: string;

  nextActionAt?: string;

  lastContactAt?: string;

  createdAt: string;

  updatedAt: string;
};

export type TimelineEvent = {
  id: string;

  companyId: string;

  opportunityId?: string;

  type: TimelineEventType;

  title: string;

  description?: string;

  createdBy?: string;

  createdAt: string;

  metadata?: Record<string, unknown>;
};

export type Task = {
  id: string;

  companyId?: string;

  opportunityId?: string;

  title: string;

  description?: string;

  dueAt?: string;

  status: TaskStatus;

  priority: TaskPriority;

  createdAt: string;

  completedAt?: string;
};

export type EmailDraft = {
  id: string;

  companyId: string;

  opportunityId?: string;

  contactId?: string;

  to: string[];

  cc?: string[];

  subject: string;

  body: string;

  attachmentIds: string[];

  status: EmailStatus;

  createdAt: string;

  sentAt?: string;
};

export type Reminder = {
  id: string;

  companyId?: string;

  opportunityId?: string;

  title: string;

  description?: string;

  remindAt: string;

  status: ReminderStatus;

  createdAt: string;

  completedAt?: string;
};

export type AiMemory = {
  id: string;

  companyId: string;

  opportunityId?: string;

  category:
    | "general"
    | "customer-preference"
    | "objection"
    | "pricing"
    | "commitment"
    | "next-step";

  content: string;

  importance: number;

  sourceTimelineEventId?: string;

  createdAt: string;

  updatedAt: string;
};

export type CrmState = {
  companies: Company[];

  contacts: Contact[];

  opportunities: Opportunity[];

  timelineEvents: TimelineEvent[];

  tasks: Task[];

  emails: EmailDraft[];

  reminders: Reminder[];

  aiMemories: AiMemory[];

  selectedCompanyId: string | null;

  selectedOpportunityId: string | null;
};