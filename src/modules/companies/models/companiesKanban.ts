import type { CallNote, Opportunity } from "../../../types/database";
import { isTerminalBusinessStatus } from "../../../types/businessStatus";
import type { CompanyStatusLabel } from "../../../types/businessStatus";

export const KANBAN_COLUMNS = [
  { id: "new", label: "Yeni", stages: ["new", "contacted", "interested"] },
  { id: "information", label: "Bilgilendirme", stages: ["information-sent"] },
  { id: "quotation", label: "Teklif", stages: ["quotation-ready", "proposal-ready"] },
  { id: "contract", label: "Sözleşme", stages: ["quotation-sent", "negotiation", "contract"] },
] as const;

export type KanbanColumnId = (typeof KANBAN_COLUMNS)[number]["id"];
export type LastActivitySort = "newest" | "oldest";
export type PresenceFilter = "all" | "yes" | "no";
export type NextActionFilter = "all" | "planned" | "unplanned" | "overdue";
export type ClosedStageFilter = "active" | "signed" | "won" | "lost";

export function matchesCompanyStatusFilter(
  status: CompanyStatusLabel,
  filter: "all" | CompanyStatusLabel,
): boolean {
  return filter === "all" || status === filter;
}

export function matchesPresence(
  present: boolean,
  filter: PresenceFilter,
): boolean {
  return filter === "all" || (filter === "yes" ? present : !present);
}

export function matchesNextAction(
  opportunity: Pick<Opportunity, "next_action" | "next_action_date"> | null,
  filter: NextActionFilter,
  now = new Date(),
): boolean {
  if (filter === "all") return true;
  const hasAction = Boolean(
    opportunity?.next_action?.trim() && opportunity.next_action_date,
  );
  if (filter === "unplanned") return !hasAction;
  if (!hasAction) return false;
  const due = new Date(opportunity!.next_action_date!).getTime();
  const overdue = !Number.isNaN(due) && due < now.getTime();
  return filter === "overdue" ? overdue : !overdue;
}


export function getKanbanColumnId(stage: string): KanbanColumnId | null {
  return KANBAN_COLUMNS.find((column) =>
    (column.stages as readonly string[]).includes(stage),
  )?.id ?? null;
}

export function getLatestCallNoteByCompany(
  notes: readonly CallNote[],
): Map<string, string> {
  const latest = new Map<string, string>();

  for (const note of notes) {
    const current = latest.get(note.company_id);
    if (!current || new Date(note.updated_at).getTime() > new Date(current).getTime()) {
      latest.set(note.company_id, note.updated_at);
    }
  }

  return latest;
}

export function sortCompanyIdsByLastCallNote(
  companyIds: readonly string[],
  latestByCompany: ReadonlyMap<string, string>,
  direction: LastActivitySort,
): string[] {
  return [...companyIds].sort((first, second) => {
    const firstTime = latestByCompany.has(first)
      ? new Date(latestByCompany.get(first)!).getTime()
      : null;
    const secondTime = latestByCompany.has(second)
      ? new Date(latestByCompany.get(second)!).getTime()
      : null;

    if (firstTime === null && secondTime === null) return 0;
    if (firstTime === null) return 1;
    if (secondTime === null) return -1;
    return direction === "newest" ? secondTime - firstTime : firstTime - secondTime;
  });
}

export function getFairScopedOpportunities(
  opportunities: readonly Opportunity[],
  exhibitionId: string,
  includeTerminal: boolean,
): Opportunity[] {
  return opportunities.filter(
    (opportunity) =>
      opportunity.exhibition_id === exhibitionId &&
      (includeTerminal || !isTerminalBusinessStatus(opportunity.stage)),
  );
}

export function buildWorkspacePath(opportunity: Opportunity): string {
  const params = new URLSearchParams({
    companyId: opportunity.company_id,
    opportunityId: opportunity.id,
  });
  if (opportunity.contact_id) params.set("contactId", opportunity.contact_id);
  return `/call?${params.toString()}`;
}
