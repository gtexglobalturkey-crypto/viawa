import { Archive, Inbox, Send } from "lucide-react";

import type { InboxFolder } from "../models/InboxMessage";

type FolderDefinition = {
  id: InboxFolder;
  label: string;
  icon: typeof Inbox;
};

// Sprint 25.6 — exactly these three, no more ("Başka klasör ekleme").
const FOLDERS: readonly FolderDefinition[] = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "sent", label: "Sent", icon: Send },
  { id: "archive", label: "Archive", icon: Archive },
];

type FolderSidebarProps = {
  selectedFolder: InboxFolder;
  onSelectFolder: (folder: InboxFolder) => void;
  unreadCounts: Readonly<Record<InboxFolder, number>>;
};

export function FolderSidebar({
  selectedFolder,
  onSelectFolder,
  unreadCounts,
}: FolderSidebarProps) {
  return (
    <nav
      aria-label="Klasörler"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: 10,
      }}
    >
      {FOLDERS.map((folder) => {
        const Icon = folder.icon;
        const isSelected = folder.id === selectedFolder;
        const unreadCount = unreadCounts[folder.id] ?? 0;

        return (
          <button
            key={folder.id}
            type="button"
            className={isSelected ? "btn btn-primary" : "btn"}
            onClick={() => onSelectFolder(folder.id)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              fontSize: 12,
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon size={14} />
              {folder.label}
            </span>

            {unreadCount > 0 ? (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "1px 6px",
                  borderRadius: 999,
                  background: isSelected
                    ? "rgba(255,255,255,0.25)"
                    : "var(--viawa-soft)",
                }}
              >
                {unreadCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
