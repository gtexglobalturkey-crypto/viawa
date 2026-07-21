import type {
  WorkspaceSession,
} from "./workspaceViewModel";

type MapWorkspaceSessionInput = {
  notes?: string;
};

export function mapWorkspaceSession({
  notes = "",
}: MapWorkspaceSessionInput = {}): WorkspaceSession {
  return {
    status: "active",
    statusLabel: "Active",
    notes,
  };
}