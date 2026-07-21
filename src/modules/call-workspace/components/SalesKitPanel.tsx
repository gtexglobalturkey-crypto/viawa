import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  FileSignature,
  FileText,
  Handshake,
  Map,
  Send,
} from "lucide-react";
import { Panel } from "../../../components/ui/Panel";

const recommendedPackage = {
  stage: "Görüşme",
  description:
    "Atlas, stand büyüklüğü, fiyat ve katılım koşullarını görüşen bir müşteri için bu belgeleri öneriyor.",
  items: [
    {
      title: "Kroki",
      status: "Hazır",
      reason: "Müşteri stand konumunu görüşüyor.",
      icon: Map,
    },
    {
      title: "Teklif",
      status: "Hazırlanıyor",
      reason: "24 m² için revize teklif gerekiyor.",
      icon: FileSignature,
    },
    {
      title: "Hizmetler",
      status: "Hazır",
      reason: "Müşteri dahil olan hizmetleri net biçimde görmeli.",
      icon: Handshake,
    },
  ],
};

const availableDocuments = [
  {
    title: "Fuar Broşürü",
    status: "Hazır",
    icon: FileText,
  },
  {
    title: "Fuar Kataloğu",
    status: "Hazır",
    icon: BookOpen,
  },
  {
    title: "Sektör Fuar Takvimi",
    status: "Hazır",
    icon: CalendarDays,
  },
];

export function SalesKitPanel() {
  return (
    <Panel>
      <p className="eyebrow">Satış Kiti</p>
      <h2>Önerilen Paket</h2>
      <p className="muted">{recommendedPackage.description}</p>

      <div className="task-list">
        {recommendedPackage.items.map((item) => {
          const Icon = item.icon;

          return (
            <label key={item.title}>
              <CheckCircle2 size={16} />
              <Icon size={16} />
              <span>{item.title}</span>
              <strong>{item.status}</strong>
            </label>
          );
        })}
      </div>

      <p className="eyebrow">Mevcut Belgeler</p>

      <div className="task-list">
        {availableDocuments.map((item) => {
          const Icon = item.icon;

          return (
            <label key={item.title}>
              <input type="checkbox" />
              <Icon size={16} />
              <span>{item.title}</span>
              <strong>{item.status}</strong>
            </label>
          );
        })}
      </div>

      <button className="btn btn-primary" style={{ width: "100%" }}>
        <Send size={17} />
        Seçili Paketi Gönder
      </button>
    </Panel>
  );
}