export type OrganizerStatus =
  | "active"
  | "inactive"
  | "paused";

export type Organizer = {
  id: string;

  name: string;
  country?: string;
  city?: string;
  website?: string;

  status: OrganizerStatus;

  representativeSince?: string;
  representativeUntil?: string;

  notes?: string;
};