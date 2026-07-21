import {
  useState,
  type ReactNode,
} from "react";

import { CrmStoreContext } from "./CrmStoreContext";
import { crmSeedData } from "./crmSeedData";

import type {
  AiMemory,
  Company,
  Contact,
  EmailDraft,
  Opportunity,
  Reminder,
  Task,
  TimelineEvent,
} from "./crmTypes";

type CrmStoreProviderProps = {
  children: ReactNode;
};

export function CrmStoreProvider({
  children,
}: CrmStoreProviderProps) {
  const [companies, setCompanies] = useState<Company[]>(
    crmSeedData.companies,
  );

  const [contacts, setContacts] = useState<Contact[]>(
    crmSeedData.contacts,
  );

  const [opportunities, setOpportunities] = useState<
    Opportunity[]
  >(crmSeedData.opportunities);

  const [timelineEvents, setTimelineEvents] = useState<
    TimelineEvent[]
  >(crmSeedData.timelineEvents);

  const [tasks, setTasks] = useState<Task[]>(
    crmSeedData.tasks,
  );

  const [emails, setEmails] = useState<EmailDraft[]>(
    crmSeedData.emails,
  );

  const [reminders, setReminders] = useState<Reminder[]>(
    crmSeedData.reminders,
  );

  const [aiMemories, setAiMemories] = useState<AiMemory[]>(
    crmSeedData.aiMemories,
  );

  const [
    selectedCompanyId,
    setSelectedCompanyId,
  ] = useState<string | null>(
    crmSeedData.selectedCompanyId,
  );

  const [
    selectedOpportunityId,
    setSelectedOpportunityId,
  ] = useState<string | null>(
    crmSeedData.selectedOpportunityId,
  );

  function addCompany(company: Company) {
    setCompanies((currentCompanies) => [
      ...currentCompanies,
      company,
    ]);
  }

  function updateCompany(
    companyId: string,
    updates: Partial<Omit<Company, "id" | "createdAt">>,
  ) {
    setCompanies((currentCompanies) =>
      currentCompanies.map((company) =>
        company.id === companyId
          ? {
              ...company,
              ...updates,
              updatedAt:
                updates.updatedAt ??
                new Date().toISOString(),
            }
          : company,
      ),
    );
  }

  function addContact(contact: Contact) {
    setContacts((currentContacts) => [
      ...currentContacts,
      contact,
    ]);

    setCompanies((currentCompanies) =>
      currentCompanies.map((company) =>
        company.id === contact.companyId
          ? {
              ...company,
              contactIds: company.contactIds.includes(
                contact.id,
              )
                ? company.contactIds
                : [...company.contactIds, contact.id],
              updatedAt: new Date().toISOString(),
            }
          : company,
      ),
    );
  }

  function addOpportunity(opportunity: Opportunity) {
    setOpportunities((currentOpportunities) => [
      ...currentOpportunities,
      opportunity,
    ]);

    setCompanies((currentCompanies) =>
      currentCompanies.map((company) =>
        company.id === opportunity.companyId
          ? {
              ...company,
              opportunityIds:
                company.opportunityIds.includes(
                  opportunity.id,
                )
                  ? company.opportunityIds
                  : [
                      ...company.opportunityIds,
                      opportunity.id,
                    ],
              updatedAt: new Date().toISOString(),
            }
          : company,
      ),
    );
  }

  function updateOpportunity(
    opportunityId: string,
    updates: Partial<
      Omit<Opportunity, "id" | "createdAt">
    >,
  ) {
    setOpportunities((currentOpportunities) =>
      currentOpportunities.map((opportunity) =>
        opportunity.id === opportunityId
          ? {
              ...opportunity,
              ...updates,
              updatedAt:
                updates.updatedAt ??
                new Date().toISOString(),
            }
          : opportunity,
      ),
    );
  }

  function addTimelineEvent(event: TimelineEvent) {
    setTimelineEvents((currentEvents) => [
      event,
      ...currentEvents,
    ]);
  }

  function addTask(task: Task) {
    setTasks((currentTasks) => [
      ...currentTasks,
      task,
    ]);
  }

  function updateTask(
    taskId: string,
    updates: Partial<Omit<Task, "id" | "createdAt">>,
  ) {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              ...updates,
            }
          : task,
      ),
    );
  }

  function addEmail(email: EmailDraft) {
    setEmails((currentEmails) => [
      ...currentEmails,
      email,
    ]);
  }

  function updateEmail(
    emailId: string,
    updates: Partial<
      Omit<EmailDraft, "id" | "createdAt">
    >,
  ) {
    setEmails((currentEmails) =>
      currentEmails.map((email) =>
        email.id === emailId
          ? {
              ...email,
              ...updates,
            }
          : email,
      ),
    );
  }

  function addReminder(reminder: Reminder) {
    setReminders((currentReminders) => [
      ...currentReminders,
      reminder,
    ]);
  }

  function updateReminder(
    reminderId: string,
    updates: Partial<
      Omit<Reminder, "id" | "createdAt">
    >,
  ) {
    setReminders((currentReminders) =>
      currentReminders.map((reminder) =>
        reminder.id === reminderId
          ? {
              ...reminder,
              ...updates,
            }
          : reminder,
      ),
    );
  }

  function addAiMemory(memory: AiMemory) {
    setAiMemories((currentMemories) => [
      ...currentMemories,
      memory,
    ]);
  }

  function updateAiMemory(
    memoryId: string,
    updates: Partial<
      Omit<AiMemory, "id" | "createdAt">
    >,
  ) {
    setAiMemories((currentMemories) =>
      currentMemories.map((memory) =>
        memory.id === memoryId
          ? {
              ...memory,
              ...updates,
              updatedAt:
                updates.updatedAt ??
                new Date().toISOString(),
            }
          : memory,
      ),
    );
  }

  function getCompanyById(companyId: string) {
    return companies.find(
      (company) => company.id === companyId,
    );
  }

  function getOpportunityById(
    opportunityId: string,
  ) {
    return opportunities.find(
      (opportunity) =>
        opportunity.id === opportunityId,
    );
  }

  function getCompanyTimeline(companyId: string) {
    return timelineEvents
      .filter(
        (event) => event.companyId === companyId,
      )
      .sort(
        (firstEvent, secondEvent) =>
          new Date(secondEvent.createdAt).getTime() -
          new Date(firstEvent.createdAt).getTime(),
      );
  }

  function getOpportunityTimeline(
    opportunityId: string,
  ) {
    return timelineEvents
      .filter(
        (event) =>
          event.opportunityId === opportunityId,
      )
      .sort(
        (firstEvent, secondEvent) =>
          new Date(secondEvent.createdAt).getTime() -
          new Date(firstEvent.createdAt).getTime(),
      );
  }

  function getCompanyTasks(companyId: string) {
    return tasks.filter(
      (task) => task.companyId === companyId,
    );
  }

  function getCompanyEmails(companyId: string) {
    return emails.filter(
      (email) => email.companyId === companyId,
    );
  }

  function getCompanyReminders(companyId: string) {
    return reminders.filter(
      (reminder) =>
        reminder.companyId === companyId,
    );
  }

  function getCompanyAiMemories(companyId: string) {
    return aiMemories
      .filter(
        (memory) => memory.companyId === companyId,
      )
      .sort(
        (firstMemory, secondMemory) =>
          secondMemory.importance -
          firstMemory.importance,
      );
  }

  const value = {
    companies,
    contacts,
    opportunities,
    timelineEvents,
    tasks,
    emails,
    reminders,
    aiMemories,

    selectedCompanyId,
    selectedOpportunityId,

    setSelectedCompanyId,
    setSelectedOpportunityId,

    addCompany,
    updateCompany,

    addContact,

    addOpportunity,
    updateOpportunity,

    addTimelineEvent,

    addTask,
    updateTask,

    addEmail,
    updateEmail,

    addReminder,
    updateReminder,

    addAiMemory,
    updateAiMemory,

    getCompanyById,
    getOpportunityById,

    getCompanyTimeline,
    getOpportunityTimeline,

    getCompanyTasks,
    getCompanyEmails,
    getCompanyReminders,
    getCompanyAiMemories,
  };

  return (
    <CrmStoreContext.Provider value={value}>
      {children}
    </CrmStoreContext.Provider>
  );
}