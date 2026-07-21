import { Send } from "lucide-react";
import type { FormEvent } from "react";

type Props = {
  subject: string;
  body: string;
  onSend: (
    subject: string,
    body: string,
  ) => void | Promise<void>;
};

export function EmailComposer({
  subject,
  body,
  onSend,
}: Props) {
  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const formData = new FormData(
      event.currentTarget,
    );

    const emailSubject = String(
      formData.get("subject") ?? "",
    ).trim();

    const emailBody = String(
      formData.get("body") ?? "",
    ).trim();

    if (!emailSubject || !emailBody) {
      return;
    }

    await onSend(
      emailSubject,
      emailBody,
    );
  }

  return (
    <form
      key={`${subject}-${body}`}
      className="communication-composer"
      onSubmit={handleSubmit}
    >
      <div className="communication-composer-body-stack">
        <label className="communication-composer-field">
          <span>Konu</span>

          <input
            className="communication-composer-input"
            type="text"
            name="subject"
            defaultValue={subject}
            placeholder="E-posta konusunu girin"
            required
          />
        </label>

        <label className="communication-composer-field communication-composer-body">
          <span>Mesaj</span>

          <textarea
            className="communication-composer-textarea"
            name="body"
            defaultValue={body}
            placeholder="E-posta mesajını yazın"
            required
          />
        </label>
      </div>

      <div className="communication-composer-footer">
        <div className="communication-send-summary">
          <span className="communication-send-option">
            <span className="communication-send-option-icon">
              ☑
            </span>
            <span>Zaman çizelgesi kaydı oluştur</span>
          </span>

          <span className="communication-send-option">
            <span className="communication-send-option-icon">
              ☑
            </span>
            <span>Takip hatırlatıcısı oluştur</span>
          </span>

          <span className="communication-send-option">
            <span className="communication-send-option-icon">
              ☑
            </span>
            <span>Satış kiti eklerini ekle</span>
          </span>
        </div>

        <button
          type="submit"
          className="communication-send-button"
        >
          <Send size={16} />
          E-postayı Gönder
        </button>
      </div>
    </form>
  );
}