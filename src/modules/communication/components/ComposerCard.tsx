import { Panel } from "../../../components/ui/Panel";

import { EmailComposer } from "./EmailComposer";

type Props = {
  subject: string;
  body: string;
  sending: boolean;
  sendError: string | null;
  sendSuccess: string | null;
  onSend: (
    subject: string,
    body: string,
  ) => Promise<void>;
};

export function ComposerCard({
  subject,
  body,
  sending,
  sendError,
  sendSuccess,
  onSend,
}: Props) {
  return (
    <Panel>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <p className="eyebrow" style={{ margin: 0 }}>
          E-posta Oluştur
        </p>

        {sendError && (
          <div style={{ padding: "8px 10px", borderRadius: "8px", background: "#fff4f4", color: "#b42318", border: "1px solid #f5c2c2" }}>
            <p className="muted" style={{ margin: 0, fontSize: "10px", lineHeight: 1.3 }}>
              {sendError}
            </p>
          </div>
        )}

        {sendSuccess && (
          <div style={{ padding: "8px 10px", borderRadius: "8px", background: "#f2fbf5", color: "#16724f", border: "1px solid #ccebd7" }}>
            <p className="muted" style={{ margin: 0, fontSize: "10px", lineHeight: 1.3 }}>
              {sendSuccess}
            </p>
          </div>
        )}

        {sending ? (
          <div style={{ padding: "10px 12px", borderRadius: "8px", background: "var(--atlas-soft)", border: "1px solid var(--atlas-border)" }}>
            <p className="muted" style={{ margin: 0, fontSize: "10px", lineHeight: 1.3 }}>
              E-posta kaydediliyor ve takip
              oluşturuluyor...
            </p>
          </div>
        ) : (
          <EmailComposer
            subject={subject}
            body={body}
            onSend={onSend}
          />
        )}
      </div>
    </Panel>
  );
}