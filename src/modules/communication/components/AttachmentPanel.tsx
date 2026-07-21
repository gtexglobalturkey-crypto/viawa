type Props = {
  attachments: string[];
};

export function AttachmentPanel({ attachments }: Props) {
  return (
    <div className="data-list" style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px" }}>
      {attachments.map((item) => (
        <div
          key={item}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            minWidth: 0,
            padding: "6px 8px",
            borderRadius: "8px",
            background: "var(--atlas-soft)",
          }}
        >
          <span style={{ flex: "0 0 auto", fontSize: "12px" }}>📎</span>
          <span style={{ minWidth: 0, fontSize: "10px", lineHeight: 1.3, overflowWrap: "anywhere" }}>{item}</span>
        </div>
      ))}
    </div>
  );
}