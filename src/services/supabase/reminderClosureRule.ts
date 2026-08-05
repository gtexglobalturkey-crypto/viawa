import type { Reminder } from "../../types/database";

// Kritik Akış Düzeltmesi 5 — kept in its own file, with no Supabase
// client import, purely so this exact selection rule (used by
// reminderService.completeOpenRemindersForOpportunity, the one shared
// close-out every opportunity-terminal screen — Firma Sayfası "İptal",
// Workspace Kaybedildi/Kazanıldı/İmzalar Tamamlandı — calls) can be
// unit-tested without a real Supabase client/env.
export function selectOpenRemindersForOpportunity(
  reminders: readonly Reminder[],
  opportunityId: string,
): Reminder[] {
  return reminders.filter(
    (reminder) =>
      reminder.opportunity_id === opportunityId &&
      !reminder.completed,
  );
}
