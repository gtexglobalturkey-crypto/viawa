export function matchesSearchText(
  value: string | null | undefined,
  text: string,
): boolean {
  return (value ?? "")
    .toLocaleLowerCase("tr")
    .includes(text);
}
