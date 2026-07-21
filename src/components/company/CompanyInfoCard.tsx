import { Panel } from "../ui/Panel";

type Props = {
  contactName: string;
  industry?: string | null;
  country?: string | null;
  statusLabel: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  opportunityCount: number;
  nextReminder: string;
  aiConfidence?: number | null;
};

export function CompanyInfoCard({
  contactName,
  industry,
  country,
  statusLabel,
  phone,
  email,
  website,
  opportunityCount,
  nextReminder,
  aiConfidence,
}: Props) {
  return (
    <Panel className="company-info-card">
      <p className="eyebrow">
        Firma Bilgileri
      </p>

      <h2>Firma Profili</h2>

      <div className="data-list">
        <div>
          <span>Birincil Kişi</span>
          <strong>{contactName}</strong>
        </div>

        <div>
          <span>Sektör</span>
          <strong>
            {industry ?? "Atanmadı"}
          </strong>
        </div>

        <div>
          <span>Ülke</span>
          <strong>
            {country ?? "Kayıtlı değil"}
          </strong>
        </div>

        <div>
          <span>Durum</span>
          <strong>{statusLabel}</strong>
        </div>

        <div>
          <span>Telefon</span>
          <strong>
            {phone ?? "Kayıtlı değil"}
          </strong>
        </div>

        <div>
          <span>E-posta</span>
          <strong>
            {email ?? "Kayıtlı değil"}
          </strong>
        </div>

        <div>
          <span>Web Sitesi</span>
          <strong>
            {website ?? "Kayıtlı değil"}
          </strong>
        </div>

        <div>
          <span>Aktif Fırsatlar</span>
          <strong>{opportunityCount}</strong>
        </div>

        <div>
          <span>Sonraki Hatırlatıcı</span>
          <strong>{nextReminder}</strong>
        </div>

        <div>
          <span>AI Güveni</span>
          <strong>
            {aiConfidence === undefined ||
            aiConfidence === null
              ? "Puanlanmadı"
              : `${aiConfidence}%`}
          </strong>
        </div>
      </div>
    </Panel>
  );
}