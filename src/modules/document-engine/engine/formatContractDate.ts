// Sprint 25.3 — extracted from ParticipationContractDocument.tsx's own
// private formatDate (unchanged logic, moved so it has no React/JSX
// dependency) so both the live preview and the server-side DOCX
// generation orchestrator (generateParticipationContract.ts) share the
// exact same short, deterministic dd.MM.yyyy formatter — never a raw
// ISO datetime string in a user-facing contract field.
export function formatContractDate(
  value: string | undefined,
): string {
  if (!value || value.trim().length === 0) {
    return "—";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsedDate);
}
