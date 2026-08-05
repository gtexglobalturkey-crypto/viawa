import { useEffect, useMemo, useState } from "react";

import { Panel } from "../../../components/ui/Panel";

import { EXHIBITION_DOCUMENTS } from "../models/ExhibitionDocument";
import type { ExhibitionDocumentId } from "../models/ExhibitionDocument";
import type { Exhibition } from "../models/Exhibition";
import type { SelectedExhibitionDocument } from "../models/SelectedExhibitionDocument";
import {
  buildExhibitionDocumentFileUrl,
  fetchExhibitionDocumentStatus,
} from "../services/exhibitionDocumentApi";
import type { ExhibitionDocumentStatus } from "../services/exhibitionDocumentApi";
import { resolveMimeType } from "../utils/resolveMimeType";

import { ExhibitionDocumentCard } from "./ExhibitionDocumentCard";
import { ExhibitionDocumentPreview } from "./ExhibitionDocumentPreview";

type ExhibitionWorkspaceProps = {
  exhibition: Exhibition | null;
  /**
   * Fires whenever the checked-off document set changes, so a host
   * component (Customer Workspace) can mirror the current selection
   * without owning the checkbox state itself. Called once on mount with
   * the initial (empty) selection too.
   */
  onSelectedDocumentsChange?: (
    documents: SelectedExhibitionDocument[],
  ) => void;
};

function formatDateRange(
  startDate?: string,
  endDate?: string,
): string | null {
  if (!startDate && !endDate) {
    return null;
  }

  const formatter = (
    value: string,
  ): string | null => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toLocaleDateString(
      "tr-TR",
      {
        day: "2-digit",
        month: "long",
        year: "numeric",
      },
    );
  };

  const start = startDate
    ? formatter(startDate)
    : null;

  const end = endDate
    ? formatter(endDate)
    : null;

  if (start && end) {
    return `${start} – ${end}`;
  }

  return start ?? end;
}

export function ExhibitionWorkspace({
  exhibition,
  onSelectedDocumentsChange,
}: ExhibitionWorkspaceProps) {
  const [documentStatuses, setDocumentStatuses] =
    useState<
      ExhibitionDocumentStatus[] | null
    >(null);

  const [loadError, setLoadError] = useState<
    string | null
  >(null);

  const [selectedRoleIds, setSelectedRoleIds] =
    useState<Set<ExhibitionDocumentId>>(
      new Set(),
    );

  const [previewedDocumentId, setPreviewedDocumentId] =
    useState<ExhibitionDocumentId | null>(
      null,
    );

  // Sprint 25.10 — a previous exhibition's checked-off selection and open
  // preview must never survive a fuar switch (even though both fuars may
  // happen to offer the same document *roles*, e.g. both have a
  // "Broşür"). Reset alongside the status refetch below, on the same
  // exhibition-identity change.
  useEffect(() => {
    if (!exhibition) {
      setDocumentStatuses(null);
      setLoadError(null);
      setSelectedRoleIds(new Set());
      setPreviewedDocumentId(null);

      return;
    }

    let cancelled = false;

    setDocumentStatuses(null);
    setLoadError(null);
    setSelectedRoleIds(new Set());
    setPreviewedDocumentId(null);

    fetchExhibitionDocumentStatus(
      exhibition.name,
      exhibition.shortName,
    )
      .then((statuses) => {
        if (!cancelled) {
          setDocumentStatuses(statuses);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Fuar belgeleri alınamadı.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [exhibition]);

  function documentExists(
    id: ExhibitionDocumentId,
  ): boolean {
    return (
      documentStatuses?.find(
        (status) => status.id === id,
      )?.exists ?? false
    );
  }

  function documentFileName(
    id: ExhibitionDocumentId,
  ): string | null {
    return (
      documentStatuses?.find(
        (status) => status.id === id,
      )?.fileName ?? null
    );
  }

  function toggleDocumentSelected(
    id: ExhibitionDocumentId,
  ) {
    if (!documentExists(id)) {
      return;
    }

    setSelectedRoleIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function handlePreview(
    id: ExhibitionDocumentId,
  ) {
    if (!documentExists(id)) {
      return;
    }

    setPreviewedDocumentId(id);
  }

  const selectedDocuments = useMemo<
    SelectedExhibitionDocument[]
  >(() => {
    if (!exhibition) {
      return [];
    }

    return EXHIBITION_DOCUMENTS.filter(
      (document) =>
        selectedRoleIds.has(document.id) &&
        documentExists(document.id),
    ).map((document) => {
      const fileName =
        documentFileName(document.id) ??
        document.title;

      return {
        exhibitionId: exhibition.id,
        exhibitionName: exhibition.name,
        role: document.id,
        displayName: document.title,
        fileName,
        resolvedUrl:
          buildExhibitionDocumentFileUrl(
            document.id,
            exhibition.name,
            exhibition.shortName,
          ),
        mimeType:
          resolveMimeType(fileName),
        exists: true as const,
        source: "document-basket" as const,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    exhibition,
    selectedRoleIds,
    documentStatuses,
  ]);

  useEffect(() => {
    onSelectedDocumentsChange?.(
      selectedDocuments,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDocuments]);

  if (!exhibition) {
    return (
      <Panel className="exhibition-workspace-panel exhibition-workspace-empty">
        <p className="muted">
          Başlamak için soldaki menüden bir
          fuar seçin.
        </p>
      </Panel>
    );
  }

  const previewedDocument =
    EXHIBITION_DOCUMENTS.find(
      (document) =>
        document.id ===
        previewedDocumentId,
    ) ?? null;

  const dateRangeLabel = formatDateRange(
    exhibition.startDate,
    exhibition.endDate,
  );

  const locationLabel = [
    exhibition.city,
    exhibition.country,
  ]
    .filter(Boolean)
    .join(", ");

  const titleLabel = [
    exhibition.shortName,
    dateRangeLabel,
    locationLabel,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <Panel className="exhibition-workspace-panel">
      <div className="exhibition-workspace-titlebar">
        <h2>{titleLabel}</h2>
      </div>

      {loadError && (
        <p
          role="alert"
          className="exhibition-workspace-error"
        >
          {loadError}
        </p>
      )}

      <div className="exhibition-workspace-doc-bar">
        {EXHIBITION_DOCUMENTS.map(
          (document) => (
            <ExhibitionDocumentCard
              key={document.id}
              document={document}
              exists={documentExists(
                document.id,
              )}
              isSelected={selectedRoleIds.has(
                document.id,
              )}
              isPreviewed={
                previewedDocumentId ===
                document.id
              }
              onPreview={() =>
                handlePreview(document.id)
              }
              onToggleSelected={() =>
                toggleDocumentSelected(
                  document.id,
                )
              }
            />
          ),
        )}
      </div>

      <ExhibitionDocumentPreview
        document={previewedDocument}
        fileName={
          previewedDocumentId
            ? documentFileName(
                previewedDocumentId,
              )
            : null
        }
        fileUrl={
          previewedDocumentId &&
          documentExists(
            previewedDocumentId,
          )
            ? buildExhibitionDocumentFileUrl(
                previewedDocumentId,
                exhibition.name,
                exhibition.shortName,
              )
            : null
        }
        isSelected={
          previewedDocumentId !== null &&
          selectedRoleIds.has(
            previewedDocumentId,
          )
        }
        onToggleSelected={() => {
          if (previewedDocumentId) {
            toggleDocumentSelected(
              previewedDocumentId,
            );
          }
        }}
      />

      <div className="exhibition-workspace-footer">
        <p className="exhibition-workspace-footer-title">
          Gönderilecek Belgeler
        </p>

        {selectedDocuments.length === 0 ? (
          <p className="muted">
            Henüz belge seçilmedi.
          </p>
        ) : (
          <ul className="exhibition-workspace-footer-list">
            {selectedDocuments.map(
              (document) => (
                <li key={document.role}>
                  {document.displayName}
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </Panel>
  );
}
