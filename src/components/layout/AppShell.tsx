import type { ReactNode } from "react";

import { ExhibitionSelectionProvider } from "../../modules/exhibitions/context/ExhibitionSelectionContext";

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
      <ExhibitionSelectionProvider>
        <div className="viawa-shell">
          <Sidebar />

          <div className="viawa-main">
            <Topbar />

            {children}
          </div>
        </div>
      </ExhibitionSelectionProvider>
    </WorkspaceHeaderProvider>
  );
}
