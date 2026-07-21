import {
  CheckCircle2,
  Inbox,
  Mail,
  Send,
} from "lucide-react";

import { Panel } from "../ui/Panel";

type Props = {
  data: {
    draftEmails: {
      length: number;
    };
  };
};

export function EmailFirstCard({
  data,
}: Props) {
  const draftCount =
    data.draftEmails.length;

  const hasDrafts = draftCount > 0;

  return (
    <Panel>
      <p className="eyebrow" style={{ marginBottom: "4px" }}>
        Buradan Başlayın
      </p>

      <h2 style={{ margin: "0 0 8px", lineHeight: 1.2 }}>Önce Gelen Kutusu</h2>

      {hasDrafts ? (
        <>
          <div
            className="today-action-row"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              marginBottom: "8px",
            }}
          >
            <Mail
              size={18}
              style={{
                flex: "0 0 auto",
                marginTop: "2px",
              }}
            />

            <div
              style={{
                minWidth: 0,
              }}
            >
              <strong
                style={{
                  display: "block",
                  lineHeight: 1.2,
                  fontSize: "12px",
                }}
              >
                Bekleyen taslak e-postaları gözden geçirin
              </strong>

              <p
                className="muted"
                style={{
                  margin: "2px 0 0",
                  lineHeight: 1.3,
                  fontSize: "11px",
                }}
              >
                Yeni aramalar yapmadan önce müşteri
                yanıtlarını gönderin.
              </p>
            </div>
          </div>

          <div
            className="today-stats-row"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div>
              <span>Bekliyor</span>

              <strong>
                {draftCount}
              </strong>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                minWidth: 0,
              }}
            >
              <Send
                size={16}
                style={{
                  flex: "0 0 auto",
                }}
              />

              <span>
                Gönderilmeye hazır
              </span>
            </div>
          </div>
        </>
      ) : (
        <>
          <div
            className="today-action-row"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              marginBottom: "8px",
            }}
          >
            <CheckCircle2
              size={18}
              style={{
                flex: "0 0 auto",
                marginTop: "2px",
              }}
            />

            <div
              style={{
                minWidth: 0,
              }}
            >
              <strong
                style={{
                  display: "block",
                  lineHeight: 1.2,
                  fontSize: "12px",
                }}
              >
                Gelen kutusu kontrol altında
              </strong>

              <p
                className="muted"
                style={{
                  margin: "2px 0 0",
                  lineHeight: 1.3,
                  fontSize: "11px",
                }}
              >
                Bekleyen taslak e-posta yok.
              </p>
            </div>
          </div>

          <div
            className="today-stats-row"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Inbox
              size={16}
              style={{
                flex: "0 0 auto",
              }}
            />

            <span
              style={{
                lineHeight: 1.3,
              }}
            >
              Planlanan aramalara devam edin.
            </span>
          </div>
        </>
      )}
    </Panel>
  );
}