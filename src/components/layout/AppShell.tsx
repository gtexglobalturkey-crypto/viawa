import type { ReactNode } from "react";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { WorkspaceHeaderProvider } from "./workspaceHeaderContext";

type Props = {
  children: ReactNode;
};

export function AppShell({
  children,
}: Props) {
  return (
    <WorkspaceHeaderProvider>
      <div className="atlas-shell">
        <Sidebar />

        <div className="atlas-main">
          <Topbar />

          {children}
        </div>
      </div>
    </WorkspaceHeaderProvider>
  );
}