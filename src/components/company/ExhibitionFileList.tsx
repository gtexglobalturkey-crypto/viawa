import { useEffect, useState } from "react";

import { Panel } from "../ui/Panel";

import type { Exhibition } from "../../services/supabase/exhibitionService";
import { isTerminalBusinessStatus } from "../../types/businessStatus";
import {
  EXHIBITION_DOCUMENTS,
} from "../../modules/exhibitions/models/ExhibitionDocument";
import {
  buildExhibitionDocumentFileUrl,
  fetchExhibitionDocumentStatus,
  type ExhibitionDocumentStatus,
} from "../../modules/exhibitions/services/exhibitionDocumentApi";
import {
  distinctExhibitionIds,
  type ExhibitionFileItem,
} from "./distinctExhibitionIds";

type Props = {
  opportunities: (ExhibitionFileItem & {
    id: string;
    stage: string;
  })[];
  exhibitionsById: Map<string, Exhibition>;
};

export function ExhibitionFileList({
  opportunities,
  exhibitionsById,
}: Props) {
  const terminalOpportunities =
    opportunities.filter((opportunity) =>
      isTerminalBusinessStatus(
        opportunity.stage,
      ),
    );

  const exhibitionIds = distinctExhibitionIds(
    terminalOpportunities,
  );

  const [openExhibitionId, setOpenExhibitionId] =
    useState<string | null>(null);

  // Kritik Akış Düzeltmesi 10 — gerçek repository durumu. Mevcut,
  // değişmeyen fetchExhibitionDocumentStatus servisini (Document
  // Basket / Exhibition Repository — vite-plugins/documentBasketPlugin.ts,
  // resolveExhibitionRoot) her distinct fuar için bir kez çağırır; yeni
  // bir servis/veri modeli oluşturulmadı.
  const [
    statusByExhibitionId,
    setStatusByExhibitionId,
  ] = useState<
    Map<
      string,
      | { kind: "loading" }
      | {
          kind: "loaded";
          documents: ExhibitionDocumentStatus[];
        }
      | { kind: "error" }
    >
  >(new Map());

  useEffect(() => {
    let isActive = true;

    for (const exhibitionId of exhibitionIds) {
      const exhibition =
        exhibitionsById.get(exhibitionId);

      if (
        !exhibition ||
        statusByExhibitionId.has(exhibitionId)
      ) {
        continue;
      }

      setStatusByExhibitionId((current) =>
        new Map(current).set(exhibitionId, {
          kind: "loading",
        }),
      );

      fetchExhibitionDocumentStatus(
        exhibition.name,
      )
        .then((documents) => {
          if (!isActive) {
            return;
          }

          setStatusByExhibitionId((current) =>
            new Map(current).set(
              exhibitionId,
              {
                kind: "loaded",
                documents,
              },
            ),
          );
        })
        .catch(() => {
          if (!isActive) {
            return;
          }

          setStatusByExhibitionId((current) =>
            new Map(current).set(
              exhibitionId,
              { kind: "error" },
            ),
          );
        });
    }

    return () => {
      isActive = false;
    };
    // Yalnızca distinct fuar kimlikleri değiştiğinde yeniden çalışır —
    // statusByExhibitionId'i bağımlılığa eklemek sonsuz döngü yaratır
    // (bu effect'in kendisi onu güncelliyor).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exhibitionIds.join(","), exhibitionsById]);

  if (exhibitionIds.length === 0) {
    return (
      <div className="exhibition-file-list">
        <Panel>
          <p className="eyebrow">
            Fuar Dosyası Yok
          </p>

          <h2>
            Dosya Ekle
          </h2>

          <p className="muted">
            İlk katılım tamamlandığında ilgili
            fuar burada kendi dosyasıyla birlikte
            oluşturulacaktır.
          </p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="exhibition-file-list">
      {exhibitionIds.map((exhibitionId) => {
        const exhibition =
          exhibitionsById.get(exhibitionId);
        const isOpen =
          openExhibitionId === exhibitionId;
        const status =
          statusByExhibitionId.get(
            exhibitionId,
          );
        // Yalnızca EXHIBITION_DOCUMENTS'in bildiği (aşağıdaki genişletilmiş
        // listede de gösterilen) rolleri sayar — API'nin döndürdüğü ama bu
        // sabit rol listesinde tanımlı olmayan ek roller (repository
        // sisteminin kendi kapsamı, burada değiştirilmedi) sayaç ile
        // genişletilmiş liste arasında tutarsızlık yaratmasın diye hariç
        // tutulur.
        const knownDocumentIds = new Set(
          EXHIBITION_DOCUMENTS.map(
            (document) => document.id,
          ),
        );

        const documentCount =
          status?.kind === "loaded"
            ? status.documents.filter(
                (document) =>
                  document.exists &&
                  knownDocumentIds.has(
                    document.id,
                  ),
              ).length
            : null;

        return (
          <Panel
            className="exhibition-file"
            key={exhibitionId}
          >
            <button
              type="button"
              className="exhibition-file-header"
              aria-expanded={isOpen}
              onClick={() => {
                setOpenExhibitionId(
                  (current) =>
                    current === exhibitionId
                      ? null
                      : exhibitionId,
                );
              }}
            >
              <span className="exhibition-file-caret">
                {isOpen ? "▼" : "▶"}
              </span>

              <span className="exhibition-file-name">
                {exhibition?.name ?? "—"}
              </span>

              {documentCount !== null ? (
                <span className="exhibition-file-count">
                  {documentCount} belge
                </span>
              ) : null}
            </button>

            {isOpen ? (
              <div className="exhibition-file-body">
                {!exhibition ? (
                  <p className="muted">
                    Fuar bilgisi bulunamadı.
                  </p>
                ) : status?.kind === "error" ? (
                  <p className="muted">
                    Fuar belgeleri alınamadı.
                  </p>
                ) : status?.kind === "loaded" ? (
                  <ul className="exhibition-file-docs">
                    {EXHIBITION_DOCUMENTS.map(
                      (document) => {
                        const found =
                          status.documents.find(
                            (item) =>
                              item.id ===
                              document.id,
                          );

                        return (
                          <li
                            key={document.id}
                            className="exhibition-file-doc-row"
                          >
                            <span>
                              {document.title}
                            </span>

                            {found?.exists ? (
                              <a
                                href={buildExhibitionDocumentFileUrl(
                                  document.id,
                                  exhibition.name,
                                )}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Aç
                              </a>
                            ) : (
                              <span className="muted">
                                Yok
                              </span>
                            )}
                          </li>
                        );
                      },
                    )}
                  </ul>
                ) : (
                  <p className="muted">
                    Belgeler yükleniyor...
                  </p>
                )}
              </div>
            ) : null}
          </Panel>
        );
      })}
    </div>
  );
}
