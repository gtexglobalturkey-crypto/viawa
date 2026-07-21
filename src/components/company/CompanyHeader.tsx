import { Link } from "react-router-dom";

type Props = {
  companyId: string;
  companyName: string;
  contactName: string;
  statusLabel: string;
  opportunityCount: number;
  nextAction: string;
  lastContact: string;
};

export function CompanyHeader({
  companyId,
  companyName,
  contactName,
  statusLabel,
  opportunityCount,
  nextAction,
  lastContact,
}: Props) {
  return (
    <section className="company-detail-header">
      <div className="company-detail-header-main">
        <div>
          <p className="eyebrow">
            Firma Çalışma Alanı
          </p>

          <h1>{companyName}</h1>

          <p className="muted">
            {contactName} · {statusLabel}
          </p>
        </div>

        <div className="company-detail-header-actions">
          <Link
            className="btn"
            to={`/communication?companyId=${encodeURIComponent(
              companyId,
            )}`}
          >
            E-posta Gönder
          </Link>

          <Link
            className="btn btn-primary"
            to={`/call?companyId=${encodeURIComponent(
              companyId,
            )}`}
          >
            Satış Görüşmesi Başlat
          </Link>
        </div>
      </div>

      <div className="company-detail-summary-grid">
        <div>
          <span>Fırsatlar</span>

          <strong>
            {opportunityCount}
          </strong>
        </div>

        <div>
          <span>Sonraki Aksiyon</span>

          <strong>
            {nextAction}
          </strong>
        </div>

        <div>
          <span>Son İletişim</span>

          <strong>
            {lastContact}
          </strong>
        </div>
      </div>
    </section>
  );
}