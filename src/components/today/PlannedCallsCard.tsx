import {
  CheckCircle2,
  PhoneCall,
  PhoneForwarded,
} from "lucide-react";

import { Panel } from "../ui/Panel";

type PendingCall = {
  id: string;
  company_id: string | null;
  title: string;
  due_date: string | null;
};

type Props = {
  data: {
    pendingCalls: PendingCall[];
    companyNames: Map<string, string>;
  };
};

function getCallSummary(
  callCount: number,
): string {
  if (callCount === 1) {
    return "1 planlanmış arama bekliyor.";
  }

  return `${callCount} planlanmış arama bekliyor.`;
}

function getCompanyName(
  call: PendingCall,
  companyNames: Map<string, string>,
): string {
  if (!call.company_id) {
    return "Müşteri takibi";
  }

  return (
    companyNames.get(call.company_id) ??
    "Müşteri takibi"
  );
}

const ENGINE_TITLE_TRANSLATIONS: Record<
  string,
  string
> = {
  "Schedule follow-up call":
    "Takip araması planlayın",
  "Wait for quotation feedback":
    "Teklif geri bildirimini bekleyin",
  "Negotiate final offer":
    "Son teklifi müzakere edin",
  "Track signed contract":
    "İmzalanan sözleşmeyi takip edin",
  "Review call outcome and complete next action":
    "Arama sonucunu değerlendirin ve sonraki adımı tamamlayın",
};

function getCallTitle(
  call: PendingCall,
): string {
  const title = call.title.trim();

  if (!title) {
    return "Takip araması";
  }

  return (
    ENGINE_TITLE_TRANSLATIONS[title] ??
    title
  );
}

export function PlannedCallsCard({
  data,
}: Props) {
  const pendingCallCount =
    data.pendingCalls.length;

  const hasCalls =
    pendingCallCount > 0;

  const nextCall =
    data.pendingCalls[0] ?? null;

  const nextCompanyName =
    nextCall
      ? getCompanyName(
          nextCall,
          data.companyNames,
        )
      : "";

  const nextCallTitle =
    nextCall
      ? getCallTitle(nextCall)
      : "";

  return (
    <Panel>
      <p className="eyebrow" style={{ marginBottom: "4px" }}>
        Arama Planı
      </p>

      <h2 style={{ margin: "0 0 8px", lineHeight: 1.2 }}>Bugünkü Aramalar</h2>

      {hasCalls && nextCall ? (
        <>
          <div className="today-action-row" style={{ gap: "8px", marginBottom: "8px" }}>
            <PhoneForwarded size={18} />

            <div>
              <strong style={{ display: "block", lineHeight: 1.2, fontSize: "12px" }}>
                Planlanan aramalarınızı tamamlayın
              </strong>

              <p className="muted" style={{ margin: "2px 0 0", lineHeight: 1.3, fontSize: "11px" }}>
                {getCallSummary(
                  pendingCallCount,
                )} Yeni adaylarla iletişime
                geçmeden önce müşteri takipleriyle
                başlayın.
              </p>
            </div>
          </div>

          <div className="today-call-preview" style={{ marginTop: "6px", gap: "6px" }}>
            <div className="today-call-preview-item">
              <span>Sıradaki müşteri</span>

              <strong style={{ fontSize: "12px", lineHeight: 1.25 }}>
                {nextCompanyName}
              </strong>
            </div>

            <div className="today-call-preview-item">
              <span>Sıradaki arama</span>

              <strong style={{ fontSize: "12px", lineHeight: 1.25 }}>
                {nextCallTitle}
              </strong>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="today-action-row" style={{ gap: "8px", marginBottom: "8px" }}>
            <CheckCircle2 size={18} />

            <div>
              <strong style={{ display: "block", lineHeight: 1.2, fontSize: "12px" }}>
                Planlanan aramalar tamamlandı
              </strong>

              <p className="muted" style={{ margin: "2px 0 0", lineHeight: 1.3, fontSize: "11px" }}>
                Gecikmiş takiplere devam edin
                veya pipeline'dan yeni bir
                adayla iletişime geçin.
              </p>
            </div>
          </div>

          <div className="today-stats-row" style={{ gap: "6px" }}>
            <PhoneCall size={16} />

            <span style={{ lineHeight: 1.3, fontSize: "11px" }}>
              Bekleyen planlanmış arama yok.
            </span>
          </div>
        </>
      )}
    </Panel>
  );
}