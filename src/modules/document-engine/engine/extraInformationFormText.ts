/** JSONB values are not guaranteed to match the TypeScript row type. */
export function extraInformationFormText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .filter((line): line is string => typeof line === "string" && Boolean(line.trim()))
    .join("\n");
}
