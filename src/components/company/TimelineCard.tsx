import { Panel } from "../ui/Panel";

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

          <h2>Son Zaman Çizelgesi</h2>

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

                <h2>{event.title}</h2>

                <p className="muted">
                  {event.description ??
                    "Açıklama kaydedilmedi."}
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