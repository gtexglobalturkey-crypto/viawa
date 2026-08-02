import { Send } from "lucide-react";
import type {
  FormEvent,
  KeyboardEvent,
} from "react";
import { useState } from "react";

export type RecipientOption = {
  id: string;
  label: string;
  email: string;
  isPrimary: boolean;
  isSignatory: boolean;
};

type Props = {
  subject: string;
  body: string;
  recipientOptions: RecipientOption[];
  toRecipients: string[];
  ccRecipients: string[];
  bccRecipients: string[];
  onToChange: (recipients: string[]) => void;
  onCcChange: (recipients: string[]) => void;
  onBccChange: (recipients: string[]) => void;
  onSend: (
    subject: string,
    body: string,
  ) => void | Promise<void>;
};

export function EmailComposer({
  subject,
  body,
  recipientOptions,
  toRecipients,
  ccRecipients,
  bccRecipients,
  onToChange,
  onCcChange,
  onBccChange,
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "8px",
          }}
        >
          <RecipientField
            label="TO"
            values={toRecipients}
            blockedValues={[
              ...ccRecipients,
              ...bccRecipients,
            ]}
            options={recipientOptions}
            onChange={onToChange}
          />

          <RecipientField
            label="CC"
            values={ccRecipients}
            blockedValues={[
              ...toRecipients,
              ...bccRecipients,
            ]}
            options={recipientOptions}
            onChange={onCcChange}
          />

          <RecipientField
            label="BCC"
            values={bccRecipients}
            blockedValues={[
              ...toRecipients,
              ...ccRecipients,
            ]}
            options={recipientOptions}
            onChange={onBccChange}
          />
        </div>

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
        <p
          className="muted"
          style={{
            margin: "0 0 8px",
            fontSize: "11px",
            lineHeight: 1.4,
          }}
        >
          Ekler VIAWA kaydına dahil edilir.
          Dış e-posta gönderimi henüz
          bağlı değildir.
        </p>

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

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

type RecipientFieldProps = {
  label: "TO" | "CC" | "BCC";
  values: string[];
  blockedValues: string[];
  options: RecipientOption[];
  onChange: (recipients: string[]) => void;
};

function RecipientField({
  label,
  values,
  blockedValues,
  options,
  onChange,
}: RecipientFieldProps) {
  const [manualEmail, setManualEmail] =
    useState("");
  const [validationMessage, setValidationMessage] =
    useState<string | null>(null);

  const normalizedValues = new Set(
    values.map(normalizeEmail),
  );
  const blockedEmails = new Set(
    blockedValues.map(normalizeEmail),
  );

  function addRecipient(rawEmail: string): void {
    const email = normalizeEmail(rawEmail);

    if (!EMAIL_PATTERN.test(email)) {
      setValidationMessage(
        "Geçerli bir e-posta adresi girin.",
      );

      return;
    }

    if (
      normalizedValues.has(email) ||
      blockedEmails.has(email)
    ) {
      setValidationMessage(
        "Bu e-posta TO, CC veya BCC alanlarından birinde zaten seçili.",
      );

      return;
    }

    onChange([...values, email]);
    setManualEmail("");
    setValidationMessage(null);
  }

  function handleManualKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
  ): void {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    addRecipient(manualEmail);
  }

  return (
    <div className="communication-composer-field">
      <span>{label}</span>

      <select
        className="communication-composer-input"
        aria-label={`${label} için kayıtlı kişi seçin`}
        defaultValue=""
        onChange={(event) => {
          const option = options.find(
            (candidate) =>
              candidate.id === event.target.value,
          );

          if (option) {
            addRecipient(option.email);
          }

          event.target.value = "";
        }}
      >
        <option value="">
          Kayıtlı kişi seçin
        </option>

        {options.map((option) => {
          const email = normalizeEmail(option.email);
          const roles = [
            option.isPrimary
              ? "Ana İletişim"
              : "",
            option.isSignatory
              ? "İmza Yetkilisi"
              : "",
          ].filter(Boolean);

          return (
            <option
              key={option.id}
              value={option.id}
              disabled={
                normalizedValues.has(email) ||
                blockedEmails.has(email)
              }
            >
              {option.label} — {option.email}
              {roles.length > 0
                ? ` (${roles.join(", ")})`
                : ""}
            </option>
          );
        })}
      </select>

      <div style={{ display: "flex", gap: "4px" }}>
        <input
          className="communication-composer-input"
          type="email"
          value={manualEmail}
          placeholder="E-posta ekle"
          aria-label={`${label} manuel e-posta`}
          onChange={(event) => {
            setManualEmail(event.target.value);
            setValidationMessage(null);
          }}
          onKeyDown={handleManualKeyDown}
        />

        <button
          type="button"
          className="btn"
          onClick={() => addRecipient(manualEmail)}
        >
          Ekle
        </button>
      </div>

      {values.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "4px",
          }}
        >
          {values.map((email) => (
            <span
              key={email}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 6px",
                borderRadius: "999px",
                background: "var(--atlas-soft)",
                border: "1px solid var(--atlas-border)",
                fontSize: "10px",
              }}
            >
              {email}
              <button
                type="button"
                aria-label={`${email} alıcısını kaldır`}
                onClick={() =>
                  onChange(
                    values.filter(
                      (value) => value !== email,
                    ),
                  )
                }
                style={{
                  border: 0,
                  padding: 0,
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {validationMessage ? (
        <span
          role="alert"
          style={{ color: "#b42318", fontSize: "10px" }}
        >
          {validationMessage}
        </span>
      ) : null}
    </div>
  );
}
