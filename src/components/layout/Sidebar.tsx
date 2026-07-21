import {
  Brain,
  Briefcase,
  Building2,
  CalendarDays,
  Home,
  Inbox,
  PhoneCall,
  Settings,
  Users,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { useWorkspaceHeader } from "./workspaceHeaderContext";

const groups = [
  {
    title: "Today",
    items: [
      {
        label: "Today",
        to: "/today",
        icon: Home,
      },
      {
        label: "Inbox",
        to: "/today",
        icon: Inbox,
      },
      {
        label: "Calendar",
        to: "/today",
        icon: CalendarDays,
      },
    ],
  },
  {
    title: "Sales",
    items: [
      {
        label: "Companies",
        to: "/companies",
        icon: Building2,
      },
      {
        label: "Participation",
        to: "/opportunities",
        icon: Briefcase,
      },
      {
        label: "Sales Session",
        to: "/call",
        icon: PhoneCall,
      },
      {
        label: "People",
        to: "/companies",
        icon: Users,
      },
    ],
  },
  {
    title: "Intelligence",
    items: [
      {
        label: "AI Brain",
        to: "/call",
        icon: Brain,
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        label: "Settings",
        to: "/today",
        icon: Settings,
      },
    ],
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
        {groups.map((group) => (
          <section key={group.title}>
            <p className="atlas-nav-group">
              {group.title}
            </p>

            {group.items.map((item) => {
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
          </section>
        ))}
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