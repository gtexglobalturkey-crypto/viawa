import { useState } from "react";

import { Panel } from "../ui/Panel";

import type { Exhibition } from "../../services/supabase/exhibitionService";
import { isTerminalBusinessStatus } from "../../types/businessStatus";

type ExhibitionFileItem = {
  id: string;
  stage: string;
  exhibition_id?: string | null;
};

type Props = {
  opportunities: ExhibitionFileItem[];
  exhibitionsById: Map<string, Exhibition>;
  formatStage: (
    value?: string | null,
  ) => string;
};

const DOCUMENT_CATEGORIES = [
  "Sözleşme",
  "Teklif",
  "Tahsilat",
  "Fatura",
  "Floor Plan",
  "Stand Tasarımı",
  "Diğer Belgeler",
];

export function ExhibitionFileList({
  opportunities,
  exhibitionsById,
  formatStage,
}: Props) {
  const files = opportunities.filter(
    (opportunity) =>
      isTerminalBusinessStatus(
        opportunity.stage,
      ),
  );

  const [openId, setOpenId] = useState<
    string | null
  >(null);

  if (files.length === 0) {
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
      {files.map((opportunity) => {
        const exhibition =
          opportunity.exhibition_id
            ? exhibitionsById.get(
                opportunity.exhibition_id,
              )
            : undefined;

        const isOpen =
          openId === opportunity.id;

        return (
          <Panel
            className="exhibition-file"
            key={opportunity.id}
          >
            <button
              type="button"
              className="exhibition-file-header"
              aria-expanded={isOpen}
              onClick={() => {
                setOpenId((current) =>
                  current === opportunity.id
                    ? null
                    : opportunity.id,
                );
              }}
            >
              <span className="exhibition-file-caret">
                {isOpen ? "▼" : "▶"}
              </span>

              <span className="exhibition-file-name">
                {exhibition?.name ?? "—"}
              </span>
            </button>

            {isOpen ? (
              <div className="exhibition-file-body">
                <div className="data-list exhibition-file-meta">
                  <div>
                    <span>Durum</span>
                    <strong>
                      {formatStage(
                        opportunity.stage,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Stand</span>
                    <strong>—</strong>
                  </div>
                </div>

                <p className="eyebrow exhibition-file-docs-label">
                  Belgeler
                </p>

                <ul className="exhibition-file-docs">
                  {DOCUMENT_CATEGORIES.map(
                    (category) => (
                      <li key={category}>
                        {category}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ) : null}
          </Panel>
        );
      })}
    </div>
  );
}
