export type SearchResultType =
  | "company"
  | "contact"
  | "exhibition";

export type SearchResult = {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  path: string;
};