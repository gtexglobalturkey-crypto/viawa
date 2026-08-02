import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

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
    return "Kayıtlı değil";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Kayıtlı değil";
  }

  return new Intl.DateTimeFormat("tr-TR", {
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
            "Referans veriler yüklenemedi.",
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
          eyebrow="Referans Veriler"
          title="Ana Veriler"
          subtitle="VIAWA sektörleri, organizatörleri ve fuarları yüklüyor."
        />

        <Panel>
          <h2>Ana veriler yükleniyor...</h2>

          <p className="muted">
            Referans listeleri Supabase'den
            yükleniyor.
          </p>
        </Panel>
      </main>
    );
  }

  if (data.error) {
    return (
      <main className="page">
        <PageHeader
          eyebrow="Referans Veriler"
          title="Ana Veriler"
          subtitle="Referans veriler hazırlanamadı."
        />

        <Panel>
          <h2>Ana veriler yüklenemedi</h2>

          <p className="muted">{data.error}</p>
        </Panel>
      </main>
    );
  }

  return (
    <main className="page">
      <PageHeader
        eyebrow="Referans Veriler"
        title="Ana Veriler"
        subtitle="VIAWA'nın içe aktarma, filtreleme ve raporlar için kullandığı referans listelerini yönetin."
      />

      <section className="today-grid">
        <Panel>
          <p className="eyebrow">Sektörler</p>

          <h2>{sectors.length}</h2>

          <p>VIAWA'da mevcut aktif sektörler.</p>

          <strong>
            {exhibitionSectors.length} fuarlarda kullanılıyor
          </strong>
        </Panel>

        <Panel>
          <p className="eyebrow">Organizatörler</p>

          <h2>{organizers.length}</h2>

          <p>
            Fuar portföyünde şu anda yer alan
            organizatörler.
          </p>

          <strong>{organizers.length} aktif</strong>
        </Panel>

        <Panel>
          <p className="eyebrow">Fuarlar</p>

          <h2>{data.exhibitions.length}</h2>

          <p>
            Supabase'de mevcut fuar kayıtları.
          </p>

          <strong>
            {upcomingExhibitions.length} yaklaşan
          </strong>
        </Panel>

        <Panel>
          <p className="eyebrow">Ürün Grupları</p>

          <h2>0</h2>

          <p>
            Ürün grupları MVP lansmanından sonra
            eklenecek.
          </p>

          <strong>Planlandı</strong>
        </Panel>
      </section>

      <section className="panel-grid">
        <Panel>
          <p className="eyebrow">Sektörler</p>

          <h2>{sectors.length} aktif sektör</h2>

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
          <p className="eyebrow">Organizatörler</p>

          <h2>{organizers.length} organizatör</h2>

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
                    fuar
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">
              Organizatör kaydı bulunamadı.
            </p>
          )}
        </Panel>
      </section>

      <section className="section-head">
        <div>
          <p className="eyebrow">Portföy</p>

          <h2>Fuarlar</h2>

          <p className="muted">
            Satış fırsatlarına bağlı canlı fuar
            kayıtları.
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
                    "Sektör atanmadı"}
                </p>

                <h2>{exhibition.name}</h2>

                <p className="muted">
                  {exhibition.organizer ??
                    "Organizatör atanmadı"}
                </p>
              </div>

              <div className="data-list">
                <div>
                  <span>Konum</span>

                  <strong>
                    {[
                      exhibition.city,
                      exhibition.country,
                    ]
                      .filter(Boolean)
                      .join(", ") || "Kayıtlı değil"}
                  </strong>
                </div>

                <div>
                  <span>Başlangıç Tarihi</span>

                  <strong>
                    {formatDate(
                      exhibition.start_date,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Bitiş Tarihi</span>

                  <strong>
                    {formatDate(
                      exhibition.end_date,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Sektör</span>

                  <strong>
                    {exhibition.sector ??
                      "Atanmadı"}
                  </strong>
                </div>
              </div>

              <Link
                to={`/exhibitions/${exhibition.id}/repository`}
                className="btn btn-secondary"
                style={{
                  marginTop: "12px",
                  alignSelf:
                    "flex-start",
                }}
              >
                Repository'yi Aç
              </Link>
            </Panel>
          ))
        ) : (
          <Panel>
            <p className="eyebrow">
              Fuar Yok
            </p>

            <h2>Henüz fuar kaydı yok</h2>

            <p className="muted">
              Satış portföyünü oluşturmak için
              Supabase'e fuar ekleyin.
            </p>
          </Panel>
        )}
      </section>
    </main>
  );
}