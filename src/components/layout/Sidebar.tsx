import {
  Building2,
  Home,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { useWorkspaceHeader } from "./workspaceHeaderContext";

const items = [
  {
    label: "Today",
    to: "/today",
    icon: Home,
  },
  {
    label: "Companies",
    to: "/companies",
    icon: Building2,
  },
];

export function Sidebar() {
  const {
    aiConfidence,
    mode,
    setMode,
  } = useWorkspaceHeader();

  const showWorkspaceMode =
    aiConfidence !== null;

  return (
    <aside className="atlas-sidebar atlas-sidebar-compact">
      <div className="atlas-logo">
        ATLAS
      </div>

      <nav className="atlas-nav">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.label}
              to={item.to}
              className="atlas-nav-item"
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {showWorkspaceMode && (
        <div className="sidebar-mode-switch">
          <button
            type="button"
            className={
              mode === "manual"
                ? "active"
                : ""
            }
            onClick={() =>
              setMode("manual")
            }
          >
            Manual
          </button>

          <button
            type="button"
            className={
              mode === "automatic"
                ? "active"
                : ""
            }
            onClick={() =>
              setMode("automatic")
            }
          >
            Auto
          </button>
        </div>
      )}
    </aside>
  );
}
