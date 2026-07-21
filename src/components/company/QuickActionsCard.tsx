import { Link } from "react-router-dom";

import { Panel } from "../ui/Panel";

type Props = {
  companyId: string;
  opportunityId?: string;
};

export function QuickActionsCard({
  companyId,
  opportunityId,
}: Props) {
  const encodedCompanyId =
    encodeURIComponent(companyId);

  const callUrl = opportunityId
    ? `/call?companyId=${encodedCompanyId}&opportunityId=${encodeURIComponent(
        opportunityId,
      )}`
    : `/call?companyId=${encodedCompanyId}`;

  return (
    <Panel className="company-quick-actions-card">
      <p className="eyebrow">
        Hızlı İşlemler
      </p>

      <h2>Çalışmaya Devam Et</h2>

      <p className="muted">
        Firma çalışma alanından ayrılmadan sonraki
        müşteri aksiyonunu başlatın.
      </p>

      <div className="company-quick-actions">
        <Link
          className="btn btn-primary"
          to={callUrl}
        >
          Satış Görüşmesi Başlat
        </Link>

        <Link
          className="btn"
          to={`/communication?companyId=${encodedCompanyId}`}
        >
          E-posta Gönder
        </Link>

        <Link
          className="btn"
          to={`/opportunities?companyId=${encodedCompanyId}`}
        >
          Fırsatları Görüntüle
        </Link>

        <Link
          className="btn"
          to="/companies"
        >
          Firmalara Dön
        </Link>
      </div>
    </Panel>
  );
}