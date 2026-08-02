import { Link } from "react-router-dom";

export type CompanyHeaderTag = {
  id: string;
  name: string;
};

type Props = {
  industry?: string | null;
  sectors?: CompanyHeaderTag[];
  productGroups?: CompanyHeaderTag[];
  createdAt?: string | null;
  updatedAt?: string | null;
  companyStatusLabel: string;
  activeOpportunityCount: number;
  activeOpportunityLimit: number;
  phone?: string | null;
  email?: string | null;
  country?: string | null;
  website?: string | null;
  taxOffice?: string | null;
  taxNumber?: string | null;
  postalCode?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  editHref?: string;
};

function getWebsiteHref(website: string): string {
  return /^https?:\/\//i.test(website)
    ? website
    : `https://${website}`;
}

export function CompanyHeader({
  industry,
  sectors = [],
  productGroups = [],
  companyStatusLabel,
  activeOpportunityCount,
  activeOpportunityLimit,
  phone,
  email,
  country,
  website,
  taxOffice,
  taxNumber,
  postalCode,
  address,
  city,
  district,
  editHref,
}: Props) {
  return (
    <section className="company-detail-header">
      <div className="company-header-identity">
        <div className="company-header-summary">
          <div className="company-header-summary-item">
            <span>Firma Durumu</span>
            <strong>
              {companyStatusLabel}
            </strong>
          </div>

          <div className="company-header-summary-item">
            <span>Sektörler</span>
            <strong>
              {sectors.length > 0 ? (
                <span className="company-header-tag-list">
                  <span
                    className="company-header-tag"
                    key={sectors[0].id}
                  >
                    <em>Birincil</em>
                    {sectors[0].name}
                  </span>
                </span>
              ) : (
                industry || "—"
              )}
            </strong>
          </div>

          <div className="company-header-summary-item">
            <span>Ürün Grupları</span>
            <strong>
              {productGroups.length >
              0 ? (
                <span className="company-header-tag-list">
                  {productGroups.map(
                    (productGroup) => (
                      <span
                        className="company-header-tag"
                        key={
                          productGroup.id
                        }
                      >
                        {
                          productGroup.name
                        }
                      </span>
                    ),
                  )}
                </span>
              ) : (
                "—"
              )}
            </strong>
          </div>

          <div className="company-header-summary-item">
            <span>Aktif Fırsatlar</span>
            <strong>{activeOpportunityCount} / {activeOpportunityLimit}</strong>
          </div>
        </div>
      </div>

      <div className="section-head">
        <p className="eyebrow">
          Resmi Bilgiler
        </p>

        {editHref ? (
          <Link
            className="btn btn-secondary"
            to={editHref}
          >
            Güncelle
          </Link>
        ) : null}
      </div>

      <div className="company-identity-row">
        <div>
          <span>Telefon</span>
          <strong>
            {phone ? (
              <a href={`tel:${phone}`}>
                {phone}
              </a>
            ) : (
              "—"
            )}
          </strong>
        </div>

        <div>
          <span>E-posta</span>
          <strong>
            {email ? (
              <a href={`mailto:${email}`}>
                {email}
              </a>
            ) : (
              "—"
            )}
          </strong>
        </div>

        <div>
          <span>Vergi Dairesi</span>
          <strong>{taxOffice || "—"}</strong>
        </div>

        <div>
          <span>Vergi Numarası</span>
          <strong>{taxNumber || "—"}</strong>
        </div>

        <div>
          <span>Posta Kodu</span>
          <strong>{postalCode || "—"}</strong>
        </div>

        <div className="identity-fill">
          <span>Adres</span>
          <strong>{address || "—"}</strong>
        </div>

        <div>
          <span>Şehir</span>
          <strong>{city || "—"}</strong>
        </div>

        <div>
          <span>İlçe</span>
          <strong>{district || "—"}</strong>
        </div>

        <div>
          <span>Ülke</span>
          <strong>{country || "—"}</strong>
        </div>

        <div>
          <span>Web Sitesi</span>
          <strong>
            {website ? (
              <a
                href={getWebsiteHref(
                  website,
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                {website}
              </a>
            ) : (
              "—"
            )}
          </strong>
        </div>
      </div>
    </section>
  );
}
