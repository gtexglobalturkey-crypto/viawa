import { Link } from "react-router-dom";
import { Panel } from "../../components/ui/Panel";

export function OnboardingPage() {
  return (
    <main className="page">
      <Panel>
        <p className="eyebrow">VIAWA Temsilci Sürümü</p>

        <h1>VIAWA'ya hoş geldiniz</h1>

        <p className="muted">
          Mevcut müşteri portföyünüzü hazırlayalım ve birkaç dakika içinde
          satışa başlayalım.
        </p>

        <br />

        <h2>Mevcut müşteri veriniz var mı?</h2>

        <div className="task-list">
          <label>
            <input type="radio" checked readOnly />
            <span>Evet, bir Excel dosyam var.</span>
          </label>

          <label>
            <input type="radio" readOnly />
            <span>Hayır, sıfırdan başlamak istiyorum.</span>
          </label>
        </div>

        <br />

        <Link className="btn btn-primary" to="/today">
          Devam et
        </Link>
      </Panel>
    </main>
  );
}