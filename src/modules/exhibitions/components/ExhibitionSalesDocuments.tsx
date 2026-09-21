import { ExternalLink, FileText, ImageIcon, Map } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "../../../services/supabase/client";
import {
  getDriveFileViewUrl,
  type ExhibitionSalesDocument,
} from "../models/ExhibitionSalesDocument";
import { loadExhibitionSalesDocuments } from "../services/exhibitionSalesDocumentService";

type ViewProps = {
  documents: ExhibitionSalesDocument[];
  loading: boolean;
  error: string | null;
};

export function ExhibitionSalesDocumentsView({ documents, loading, error }: ViewProps) {
  const links = documents.flatMap((document) => {
    const url = getDriveFileViewUrl(document.driveFileId);
    return url ? [{ document, url }] : [];
  });

  return (
    <section className="exhibition-sales-documents" aria-label="Satış Dokümanları">
      <h3>Satış Dokümanları</h3>
      {loading ? (
        <p className="muted" role="status">Satış dokümanları yükleniyor...</p>
      ) : error ? (
        <p className="exhibition-sales-documents-error" role="alert">{error}</p>
      ) : links.length === 0 ? (
        <p className="muted">Henüz satış dokümanı eklenmedi.</p>
      ) : (
        <ul className="exhibition-sales-documents-links">
          {links.map(({ document, url }) => {
            const Icon = document.documentType === "floor_plan"
              ? Map
              : document.documentType === "flyer" ? ImageIcon : FileText;

            return (
              <li key={document.id}>
                <a
                  className="exhibition-sales-document-link"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{document.title}</span>
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

type LoadState = ViewProps & { exhibitionId: string };

export function ExhibitionSalesDocuments({ exhibitionId }: { exhibitionId: string }) {
  const [state, setState] = useState<LoadState>({
    exhibitionId,
    documents: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let current = true;
    setState({ exhibitionId, documents: [], loading: true, error: null });

    void loadExhibitionSalesDocuments(supabase, exhibitionId)
      .then((documents) => {
        if (current) {
          setState({ exhibitionId, documents, loading: false, error: null });
        }
      })
      .catch(() => {
        if (current) {
          setState({ exhibitionId, documents: [], loading: false, error: "Satış dokümanları yüklenemedi." });
        }
      });

    return () => { current = false; };
  }, [exhibitionId]);

  // Hide the previous exhibition's links during the render before its effect resets.
  const visible = state.exhibitionId === exhibitionId
    ? state
    : { documents: [], loading: true, error: null };

  return <ExhibitionSalesDocumentsView {...visible} />;
}
