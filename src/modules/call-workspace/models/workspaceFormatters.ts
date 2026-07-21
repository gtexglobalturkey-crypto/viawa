export function formatWorkspaceDate(
  value?: string | null,
): string {
  if (!value) {
    return "Not planned";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not planned";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatWorkspaceLabel(
  value: string,
): string {
  return value
    .split("-")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1),
    )
    .join(" ");
}

export function getWorkspaceActivityIcon(
  type?: string | null,
): string {
  switch (type) {
    case "call":
      return "📞";

    case "email":
    case "information-sent":
      return "✉️";

    case "quotation-created":
    case "quotation-sent":
      return "💰";

    case "meeting":
      return "🤝";

    case "reminder-created":
      return "📅";

    case "contract-sent":
    case "contract-signed":
      return "📄";

    case "stage-changed":
      return "🔄";

    case "company-created":
      return "🏢";

    case "note":
    case "call-note":
      return "📝";

    case "ai-memory":
      return "✨";

    default:
      return "⚡";
  }
}