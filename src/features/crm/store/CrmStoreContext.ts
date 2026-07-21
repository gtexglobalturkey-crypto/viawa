import { createContext } from "react";

import type {
  AiMemory,
  Company,
  Contact,
  CrmState,
  EmailDraft,
  Opportunity,
  Reminder,
  Task,
  TimelineEvent,
} from "./crmTypes";

export type CrmStoreContextValue = CrmState & {
  setSelectedCompanyId: (companyId: string | null) => void;

  setSelectedOpportunityId: (
    opportunityId: string | null,
  ) => void;

  addCompany: (company: Company) => void;

  updateCompany: (
    companyId: string,
    updates: Partial<Omit<Company, "id" | "createdAt">>,
  ) => void;

  addContact: (contact: Contact) => void;

  addOpportunity: (opportunity: Opportunity) => void;

  updateOpportunity: (
    opportunityId: string,
    updates: Partial<
      Omit<Opportunity, "id" | "createdAt">
    >,
  ) => void;

  addTimelineEvent: (event: TimelineEvent) => void;

  addTask: (task: Task) => void;

  updateTask: (
    taskId: string,
    updates: Partial<Omit<Task, "id" | "createdAt">>,
  ) => void;

  addEmail: (email: EmailDraft) => void;

  updateEmail: (
    emailId: string,
    updates: Partial<
      Omit<EmailDraft, "id" | "createdAt">
    >,
  ) => void;

  addReminder: (reminder: Reminder) => void;

  updateReminder: (
    reminderId: string,
    updates: Partial<
      Omit<Reminder, "id" | "createdAt">
    >,
  ) => void;

  addAiMemory: (memory: AiMemory) => void;

  updateAiMemory: (
    memoryId: string,
    updates: Partial<
      Omit<AiMemory, "id" | "createdAt">
    >,
  ) => void;

  getCompanyById: (
    companyId: string,
  ) => Company | undefined;

  getOpportunityById: (
    opportunityId: string,
  ) => Opportunity | undefined;

  getCompanyTimeline: (
    companyId: string,
  ) => TimelineEvent[];

  getOpportunityTimeline: (
    opportunityId: string,
  ) => TimelineEvent[];

  getCompanyTasks: (companyId: string) => Task[];

  getCompanyEmails: (
    companyId: string,
  ) => EmailDraft[];

  getCompanyReminders: (
    companyId: string,
  ) => Reminder[];

  getCompanyAiMemories: (
    companyId: string,
  ) => AiMemory[];
};

export const CrmStoreContext =
  createContext<CrmStoreContextValue | null>(null);