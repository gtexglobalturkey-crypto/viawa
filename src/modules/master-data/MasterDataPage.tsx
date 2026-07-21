import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "../../components/ui/PageHeader";
import { Panel } from "../../components/ui/Panel";

import { sectors } from "../../data/sectorData";

import {
  getExhibitions,
  type Exhibition,
} from "../../services/supabase/exhibitionService";

type MasterDataState = {
  exhibitions: Exhibition[];
  loading: boolean;
  error: string | null;
};

const initialState: MasterDataState = {
  exhibitions: [],
  loading: true,
  error: null,
};

function formatDate(value?: string | null): string {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function MasterDataPage() {
  const [data, setData] =
    useState<MasterDataState>(initialState);

  useEffect(() => {
    let isActive = true;

    async function loadMasterData() {
      try {
        const exhibitions = await getExhibitions();

        if (!isActive) {
          return;
        }

        setData({
          exhibitions,
          loading: false,
          error: null,
        });
      } catch (loadError) {
        console.error(
          "Master data loading error:",
          loadError,
        );

        if (!isActive) {
          return;
        }

        setData({
          exhibitions: [],
          loading: false,
          error:
            "Reference data could not be loaded.",
        });
      }
    }

    void loadMasterData();

    return () => {
      isActive = false;
    };
  }, []);

  const organizers = useMemo(
    () =>
      Array.from(
        new Set(
          data.exhibitions
            .map((exhibition) =>
              exhibition.organizer?.trim(),
            )
            .filter(
              (organizer): organizer is string =>
                Boolean(organizer),
            ),
        ),
      ).sort((firstOrganizer, secondOrganizer) =>
        firstOrganizer.localeCompare(
          secondOrganizer,
        ),
      ),
    [data.exhibitions],
  );

  const exhibitionSectors = useMemo(
    () =>
      Array.from(
        new Set(
          data.exhibitions
            .map((exhibition) =>
              exhibition.sector?.trim(),
            )
            .filter(
              (sector): sector is string =>
                Boolean(sector),
            ),
        ),
      ).sort((firstSector, secondSector) =>
        firstSector.localeCompare(secondSector),
      ),
    [data.exhibitions],
  );

  const upcomingExhibitions = useMemo(() => {
    const now = new Date().getTime();

    return data.exhibitions.filter(
      (exhibition) =>
        exhibition.start_date &&
        new Date(
          exhibition.start_date,
        ).getTime() >= now,
    );
  }, [data.exhibitions]);

  if (data.loading) {
    return (
      <main className="page">
        <PageHeader
          eyebrow="Reference Data"
          title="Master Data"
          subtitle="Atlas is loading sectors, organizers and exhibitions."
        />

        <Panel>
          <h2>Loading master data...</h2>

          <p className="muted">
            Reference lists are being loaded from
            Supabase.
          </p>
        </Panel>
      </main>
    );
  }

  if (data.error) {
    return (
      <main className="page">
        <PageHeader
          eyebrow="Reference Data"
          title="Master Data"
          subtitle="Reference data could not be prepared."
        />

        <Panel>
          <h2>Unable to load master data</h2>

          <p className="muted">{data.error}</p>
        </Panel>
      </main>
    );
  }

  return (
    <main className="page">
      <PageHeader
        eyebrow="Reference Data"
        title="Master Data"
        subtitle="Manage the reference lists Atlas uses for import, filtering and reports."
      />

      <section className="today-grid">
        <Panel>
          <p className="eyebrow">Sectors</p>

          <h2>{sectors.length}</h2>

          <p>Active sectors available in Atlas.</p>

          <strong>
            {exhibitionSectors.length} used by exhibitions
          </strong>
        </Panel>

        <Panel>
          <p className="eyebrow">Organizers</p>

          <h2>{organizers.length}</h2>

          <p>
            Organizers currently represented in the
            exhibition portfolio.
          </p>

          <strong>{organizers.length} active</strong>
        </Panel>

        <Panel>
          <p className="eyebrow">Exhibitions</p>

          <h2>{data.exhibitions.length}</h2>

          <p>
            Exhibition records available in Supabase.
          </p>

          <strong>
            {upcomingExhibitions.length} upcoming
          </strong>
        </Panel>

        <Panel>
          <p className="eyebrow">Product Groups</p>

          <h2>0</h2>

          <p>
            Product groups will be added after the MVP
            launch.
          </p>

          <strong>Planned</strong>
        </Panel>
      </section>

      <section className="panel-grid">
        <Panel>
          <p className="eyebrow">Sectors</p>

          <h2>{sectors.length} active sectors</h2>

          <div className="data-list">
            {sectors.map((sector) => (
              <div key={sector.id}>
                <span>
                  {sector.icon} {sector.name}
                </span>

                <strong>{sector.code}</strong>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <p className="eyebrow">Organizers</p>

          <h2>{organizers.length} organizers</h2>

          {organizers.length > 0 ? (
            <div className="data-list">
              {organizers.map((organizer) => (
                <div key={organizer}>
                  <span>{organizer}</span>

                  <strong>
                    {
                      data.exhibitions.filter(
                        (exhibition) =>
                          exhibition.organizer ===
                          organizer,
                      ).length
                    }{" "}
                    exhibitions
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">
              No organizer records found.
            </p>
          )}
        </Panel>
      </section>

      <section className="section-head">
        <div>
          <p className="eyebrow">Portfolio</p>

          <h2>Exhibitions</h2>

          <p className="muted">
            Live exhibition records connected to sales
            opportunities.
          </p>
        </div>
      </section>

      <section className="opportunity-list">
        {data.exhibitions.length > 0 ? (
          data.exhibitions.map((exhibition) => (
            <Panel
              className="opportunity-card"
              key={exhibition.id}
            >
              <div>
                <p className="eyebrow">
                  {exhibition.sector ??
                    "Sector not assigned"}
                </p>

                <h2>{exhibition.name}</h2>

                <p className="muted">
                  {exhibition.organizer ??
                    "Organizer not assigned"}
                </p>
              </div>

              <div className="data-list">
                <div>
                  <span>Location</span>

                  <strong>
                    {[
                      exhibition.city,
                      exhibition.country,
                    ]
                      .filter(Boolean)
                      .join(", ") || "Not recorded"}
                  </strong>
                </div>

                <div>
                  <span>Start Date</span>

                  <strong>
                    {formatDate(
                      exhibition.start_date,
                    )}
                  </strong>
                </div>

                <div>
                  <span>End Date</span>

                  <strong>
                    {formatDate(
                      exhibition.end_date,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Sector</span>

                  <strong>
                    {exhibition.sector ??
                      "Not assigned"}
                  </strong>
                </div>
              </div>
            </Panel>
          ))
        ) : (
          <Panel>
            <p className="eyebrow">
              No Exhibitions
            </p>

            <h2>No exhibition records yet</h2>

            <p className="muted">
              Add exhibitions to Supabase to build the
              sales portfolio.
            </p>
          </Panel>
        )}
      </section>
    </main>
  );
}