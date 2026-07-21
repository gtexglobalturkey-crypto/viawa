import type {
  Reminder,
} from "../../../types/database";

import type {
  WorkspaceReminder,
} from "./workspaceViewModel";

import {
  formatWorkspaceDate,
} from "./workspaceFormatters";

export function mapWorkspaceReminders(
  reminders: Reminder[],
): WorkspaceReminder[] {
  return [...reminders]
    .filter(
      (reminder) =>
        !reminder.completed,
    )
    .sort(
      (
        firstReminder,
        secondReminder,
      ) =>
        new Date(
          firstReminder.due_date ??
            "9999-12-31",
        ).getTime() -
        new Date(
          secondReminder.due_date ??
            "9999-12-31",
        ).getTime(),
    )
    .map((reminder) => ({
      id: reminder.id,
      title: reminder.title,
      description: "",
      remindAt: reminder.due_date,
      remindDateLabel:
        formatWorkspaceDate(
          reminder.due_date,
        ),
      completed: reminder.completed,
    }));
}