import {
  Building2,
  Home,
  Mail,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import viawaLogo from "../../assets/viawa-logo.png";
import { useExhibitionSelection } from "../../modules/exhibitions/context/ExhibitionSelectionContext";
import { ExhibitionSidebarSection } from "../../modules/exhibitions/components/ExhibitionSidebarSection";

import { useWorkspaceHeader } from "./workspaceHeaderContext";

const items = [
  {
    label: "Bugün",
    to: "/today",
    icon: Home,
  },
  {
    label: "Firmalar",
    to: "/companies",
    icon: Building2,
  },
  {
    label: "Mail Merkezi",
    to: "/communication-center",
    icon: Mail,
  },
];

export function Sidebar() {
  const {
    aiConfidence,
    mode,
    setMode,
  } = useWorkspaceHeader();

  const {
    exhibitions,
    setExhibitions,
    selectedExhibitionId,
    setSelectedExhibitionId,
    exhibitionsLoading,
    exhibitionsError,
  } = useExhibitionSelection();

  const showWorkspaceMode =
    aiConfidence !== null;

  return (
    <aside className="atlas-sidebar atlas-sidebar-compact">
      <div className="atlas-logo">
        <img
          src={viawaLogo}
          alt="VIAWA"
        />
      </div>

      <div className="atlas-sidebar-welcome">
        <p className="atlas-sidebar-welcome-eyebrow">
          Çalışma Asistanı
        </p>

        <p className="atlas-sidebar-welcome-name">
          Hoş geldiniz
        </p>
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

        <ExhibitionSidebarSection
          exhibitions={exhibitions}
          onExhibitionsChange={
            setExhibitions
          }
          selectedExhibitionId={
            selectedExhibitionId
          }
          onSelectExhibition={
            setSelectedExhibitionId
          }
          loading={exhibitionsLoading}
          error={exhibitionsError}
        />
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
            Manuel
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
            Otomatik
          </button>
        </div>
      )}
    </aside>
  );
}
