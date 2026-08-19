import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useToast } from "../../components/feedback/toastContext";
import { Panel } from "../../components/ui/Panel";
import { getCompanies } from "../../services/supabase/companyService";
import { getEmails } from "../../services/supabase/emailService";
import type { Company, EmailRecord } from "../../types/database";

import { ConversationList } from "./components/ConversationList";
import { FolderSidebar } from "./components/FolderSidebar";
import { MailPreviewPane } from "./components/MailPreviewPane";
import type { Conversation } from "./models/Conversation";
import {
  countUnreadInFolder,
  filterConversationsByFolder,
  groupMessagesIntoConversations,
} from "./models/conversationMapper";
import { mapEmailRecordsToInboxMessages } from "./models/emailRecordMapper";
import type { InboxFolder } from "./models/InboxMessage";

const FOLDER_IDS: readonly InboxFolder[] = [
  "inbox",
  "sent",
  "archive",
];

/**
 * Sprint 25.6 — Communication Center v1. Deliberately independent of the
 * Workspace/Commit Engine/Pricing Engine/Document Engine — this page only
 * ever reads company names (for display) and the existing `emails` table
 * (for the Sent folder); it writes nothing, ever. Inbox and Archive have
 * no real data source yet ("Gerçek Gmail / Outlook entegrasyonu YOK") —
 * their empty states are honest, not placeholder sample data. "Oku" and
 * "Arşivle" are local-only UI state (readOverrides/archivedConversationIds)
 * since there is no backend field to persist either yet.
 */
export function CommunicationCenterPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [companies, setCompanies] = useState<Company[]>(
    [],
  );
  const [emails, setEmails] = useState<EmailRecord[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<
    string | null
  >(null);

  const [selectedFolder, setSelectedFolder] =
    useState<InboxFolder>("inbox");
  const [
    selectedConversationId,
    setSelectedConversationId,
  ] = useState<string | null>(null);

  // Local-only: neither "read" nor "archived" has a backend field to
  // persist to yet (the emails table has no is_read/archived columns) —
  // see Section "MAIL ALTYAPISI". Cleared on reload, same as every other
  // "no sync yet" limitation this v1 is explicit about.
  const [readMessageIds, setReadMessageIds] = useState<
    Set<string>
  >(new Set());
  const [
    archivedConversationIds,
    setArchivedConversationIds,
  ] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    setLoading(true);

    Promise.all([getCompanies(), getEmails()])
      .then(([companiesResult, emailsResult]) => {
        if (cancelled) return;

        setCompanies(companiesResult);
        setEmails(emailsResult);
        setLoadError(null);
      })
      .catch((fetchError) => {
        if (cancelled) return;

        console.error(
          "Communication Center load error:",
          fetchError,
        );
        setLoadError(
          "Yazışmalar yüklenemedi.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const companyNamesById = useMemo(() => {
    const entries: Record<string, string> = {};

    for (const company of companies) {
      entries[company.id] = company.company_name;
    }

    return entries;
  }, [companies]);

  const messages = useMemo(() => {
    return mapEmailRecordsToInboxMessages(emails).map(
      (message) => ({
        ...message,
        isRead:
          message.isRead ||
          readMessageIds.has(message.id),
        folder: archivedConversationIds.has(
          message.conversationId,
        )
          ? ("archive" as const)
          : message.folder,
      }),
    );
  }, [emails, readMessageIds, archivedConversationIds]);

  const conversations = useMemo(
    () =>
      groupMessagesIntoConversations(
        messages,
        companyNamesById,
      ),
    [messages, companyNamesById],
  );

  const unreadCounts = useMemo(() => {
    const counts: Record<InboxFolder, number> = {
      inbox: 0,
      sent: 0,
      archive: 0,
    };

    for (const folder of FOLDER_IDS) {
      counts[folder] = countUnreadInFolder(
        conversations,
        folder,
      );
    }

    return counts;
  }, [conversations]);

  const folderConversations = useMemo(
    () =>
      filterConversationsByFolder(
        conversations,
        selectedFolder,
      ),
    [conversations, selectedFolder],
  );

  const selectedConversation =
    folderConversations.find(
      (conversation) =>
        conversation.id === selectedConversationId,
    ) ?? null;

  function handleSelectFolder(
    folder: InboxFolder,
  ): void {
    setSelectedFolder(folder);
    setSelectedConversationId(null);
  }

  function handleSelectConversation(
    conversation: Conversation,
  ): void {
    setSelectedConversationId(conversation.id);

    setReadMessageIds((current) => {
      const next = new Set(current);

      for (const message of conversation.messages) {
        next.add(message.id);
      }

      return next;
    });
  }

  function handleArchive(conversationId: string): void {
    setArchivedConversationIds((current) =>
      new Set(current).add(conversationId),
    );
    setSelectedConversationId(null);
  }

  // Section "COMMUNICATION CENTER İŞLEMLERİ" only allows Oku/Yanıtla/
  // İlet/Arşivle — none of which is a real send (there is no SMTP/API
  // here, matching Workspace Email's own honest "not really sent yet"
  // stance). Reply/Forward stay placeholders in v1.
  function handlePlaceholderAction(label: string): void {
    showToast(
      `${label} özelliği henüz bağlı değil.`,
      "info",
    );
  }

  // Section "WORKSPACE BAĞLANTISI" — allowed to be a placeholder; this
  // implementation opens the company's general Workspace shell (the same
  // route "Çalışma Alanını Aç" already uses elsewhere) without picking
  // any specific fuar/opportunity — real, richer linking is next sprint.
  function handleOpenInWorkspace(
    conversation: Conversation,
  ): void {
    if (!conversation.companyId) {
      showToast(
        "Bu yazışma bir firmayla eşleştirilmedi.",
        "error",
      );

      return;
    }

    navigate(
      `/call?companyId=${encodeURIComponent(
        conversation.companyId,
      )}`,
    );
  }

  return (
    <main className="page communication-center-page">
      <Panel
        style={{
          padding: 0,
          overflow: "hidden",
          height: "calc(100vh - 120px)",
          minHeight: 480,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "180px 300px minmax(0, 1fr)",
            height: "100%",
          }}
        >
          <div
            style={{
              borderRight:
                "1px solid var(--viawa-border)",
              overflowY: "auto",
            }}
          >
            <p
              className="eyebrow"
              style={{ padding: "12px 12px 0" }}
            >
              Mail Merkezi
            </p>

            <FolderSidebar
              selectedFolder={selectedFolder}
              onSelectFolder={handleSelectFolder}
              unreadCounts={unreadCounts}
            />
          </div>

          <div
            style={{
              borderRight:
                "1px solid var(--viawa-border)",
              overflowY: "auto",
            }}
          >
            {loading ? (
              <p
                className="muted"
                style={{ padding: 16, fontSize: 12 }}
              >
                Yükleniyor...
              </p>
            ) : loadError ? (
              <p
                role="alert"
                style={{
                  padding: 16,
                  fontSize: 12,
                  color: "#b42318",
                }}
              >
                {loadError}
              </p>
            ) : (
              <ConversationList
                conversations={folderConversations}
                selectedConversationId={
                  selectedConversationId
                }
                onSelectConversation={
                  handleSelectConversation
                }
              />
            )}
          </div>

          <MailPreviewPane
            conversation={selectedConversation}
            onReply={() =>
              handlePlaceholderAction("Yanıtla")
            }
            onForward={() =>
              handlePlaceholderAction("İlet")
            }
            onArchive={handleArchive}
            onOpenInWorkspace={handleOpenInWorkspace}
          />
        </div>
      </Panel>
    </main>
  );
}
