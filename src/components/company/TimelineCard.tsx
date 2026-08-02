import { translateSystemGeneratedText } from "../../features/execution/atlasTextTranslations";
import { TEMPLATE_DISPLAY_NAMES } from "../../modules/communication/services/templateService";
import { Panel } from "../ui/Panel";

// Timeline entries created from a Communication template send store the
// raw English template id (e.g. "Quotation") as their title — the same
// ids already have a Turkish label wherever the template picker shows
// them, reused here instead of inventing a second mapping.
function translateTimelineTitle(
  title: string,
): string {
  return (
    TEMPLATE_DISPLAY_NAMES[title] ?? title
  );
}

type TimelineItem = {
  id: string;
  type?: string | null;
  title: string;
  description?: string | null;
  created_at: string;
};

type Props = {
  timeline: TimelineItem[];
  formatDate: (
    value?: string | null,
  ) => string;
  formatStage: (
    value?: string | null,
  ) => string;
};

export function TimelineCard({
  timeline,
  formatDate,
  formatStage,
}: Props) {
  return (
    <section className="company-timeline-section">
      <div className="section-head">
        <div>
          <p className="eyebrow">
            Aktivite
          </p>

          <p className="muted">
            Bu firma için en son aktiviteler.
          </p>
        </div>
      </div>

      <div className="opportunity-list">
        {timeline.length > 0 ? (
          timeline
            .slice(0, 5)
            .map((event) => (
              <Panel
                className="company-timeline-card"
                key={event.id}
              >
                <p className="eyebrow">
                  {formatStage(
                    event.type ?? "activity",
                  )}
                </p>

                <h2>
                  {translateTimelineTitle(
                    event.title,
                  )}
                </h2>

                <p className="muted">
                  {event.description
                    ? translateSystemGeneratedText(
                        event.description,
                      )
                    : "Açıklama kaydedilmedi."}
                </p>

                <div className="data-list">
                  <div>
                    <span>Tarih</span>

                    <strong>
                      {formatDate(
                        event.created_at,
                      )}
                    </strong>
                  </div>
                </div>
              </Panel>
            ))
        ) : (
          <Panel>
            <p className="eyebrow">
              Aktivite Yok
            </p>

            <h2>
              Henüz zaman çizelgesi kaydı yok
            </h2>
          </Panel>
        )}
      </div>
    </section>
  );
}