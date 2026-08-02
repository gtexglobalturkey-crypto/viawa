function sanitizeSegment(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

function timestampLabel(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "_",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

export function createContractDocxFileName(input: {
  companyName: string;
  exhibitionName: string;
  generatedAt: Date;
}) {
  const company = sanitizeSegment(input.companyName) || "Company";
  const exhibition = sanitizeSegment(input.exhibitionName) || "Exhibition";

  return `Contract_${company}_${exhibition}_${timestampLabel(
    input.generatedAt,
  )}.docx`;
}
