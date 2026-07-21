import { useMemo } from "react";

import { WorkflowEngine } from "../core/workflow/WorkflowEngine";
import { adaptWorkflowData } from "../core/workflow/workflowDataAdapter";

import type {
  WorkflowEngineResult,
  WorkflowGenerationContext,
} from "../core/workflow/workflowTypes";

import type { AiMemory } from "../services/supabase/aiService";
import type { Company } from "../services/supabase/companyService";
import type { EmailRecord } from "../services/supabase/emailService";
import type { Opportunity } from "../services/supabase/opportunityService";
import type { Reminder } from "../services/supabase/reminderService";
import type { TimelineEvent } from "../services/supabase/timelineService";

type UseWorkflowEngineParams = {
  companies: Company[];
  emails: EmailRecord[];
  reminders: Reminder[];
  opportunities: Opportunity[];
  timelineEvents: TimelineEvent[];
  aiMemories?: AiMemory[];
  callNotes?: unknown[];
};

const workflowEngine = new WorkflowEngine();

export function useWorkflowEngine({
  companies,
  emails,
  reminders,
  opportunities,
  timelineEvents,
  aiMemories = [],
  callNotes = [],
}: UseWorkflowEngineParams): WorkflowEngineResult {
  return useMemo(() => {
    const adaptedData = adaptWorkflowData(
      companies,
      emails,
      reminders,
      opportunities,
      timelineEvents,
    );

    const context: WorkflowGenerationContext = {
      now: new Date().toISOString(),
      emails: adaptedData.emails,
      reminders: adaptedData.reminders,
      opportunities:
        adaptedData.opportunities,
      timelineEvents:
        adaptedData.timelineEvents,
      aiMemory: aiMemories,
      callNotes,
    };

    return workflowEngine.generate(
      context,
    );
  }, [
    companies,
    emails,
    reminders,
    opportunities,
    timelineEvents,
    aiMemories,
    callNotes,
  ]);
}