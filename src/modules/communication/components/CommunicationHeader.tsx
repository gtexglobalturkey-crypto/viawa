type Props = {
  companyName: string;
};

export function CommunicationHeader({
  companyName,
}: Props) {
  return (
    <header className="communication-header">
      <p className="eyebrow">
        İletişim Çalışma Alanı
      </p>

      <h1>E-posta İletişimi</h1>

      <p className="muted">
        <strong>{companyName}</strong> için
        iletişim hazırlanıyor.
      </p>
    </header>
  );
}