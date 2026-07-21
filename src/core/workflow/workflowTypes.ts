export type WorkflowTaskSource =
  | "email"
  | "planned-call"
  | "customer-response"
  | "follow-up"
  | "quotation"
  | "contract"
  | "crm-cleanup"
  | "prospecting"
  | "relationship-call";

export type WorkflowTaskType =
  | "reply-email"
  | "make-call"
  | "review-response"
  | "follow-up"
  | "send-quotation"
  | "follow-up-quotation"
  | "follow-up-contract"
  | "complete-record"
  | "contact-prospect"
  | "relationship-check-in";

export type WorkflowTaskStatus =
  | "pending"
  | "in-progress"
  | "completed"
  | "skipped"
  | "blocked";

export type WorkflowTaskPriority =
  | "critical"
  | "high"
  | "medium"
  | "low";

export type WorkflowPhase =
  | "inbox-first"
  | "planned-calls"
  | "customer-responses"
  | "follow-ups"
  | "suggested-work";

export type WorkflowEntityReference = {
  companyId?: string;
  opportunityId?: string;
  contactId?: string;
  emailId?: string;
  reminderId?: string;
};

export type WorkflowTaskAction = {
  label: string;
  route?: string;
  entityReference?: WorkflowEntityReference;
};

export type WorkflowTask = {
  id: string;

  source: WorkflowTaskSource;
  type: WorkflowTaskType;
  phase: WorkflowPhase;

  status: WorkflowTaskStatus;
  priority: WorkflowTaskPriority;

  title: string;
  description?: string;
  reason: string;

  companyName?: string;
  contactName?: string;
  opportunityTitle?: string;

  scheduledAt?: string;
  dueAt?: string;
  createdAt: string;

  estimatedMinutes: number;

  action: WorkflowTaskAction;

  metadata?: Record<
    string,
    string | number | boolean | null
  >;
};

export type WorkflowTaskCandidate =
  WorkflowTask & {
    score: number;
  };

export type WorkflowState = {
  generatedAt: string;

  currentPhase: WorkflowPhase;

  currentTask: WorkflowTask | null;
  queue: WorkflowTask[];

  completedTaskIds: string[];
  skippedTaskIds: string[];

  plannedWorkCompleted: boolean;
  suggestedWorkActive: boolean;
};

export type WorkflowCompletionResult = {
  completedTask: WorkflowTask;
  nextTask: WorkflowTask | null;
  state: WorkflowState;
};

export type WorkflowGenerationContext = {
  now: string;

  emails: unknown[];
  reminders: unknown[];
  opportunities: unknown[];
  timelineEvents: unknown[];
  aiMemory?: unknown[];
  callNotes?: unknown[];
};

export type WorkflowEngineResult = {
  currentTask: WorkflowTask | null;
  queue: WorkflowTask[];
  currentPhase: WorkflowPhase;

  plannedWorkCompleted: boolean;
  suggestedWorkActive: boolean;
};