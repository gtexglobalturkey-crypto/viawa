import { Link } from "react-router-dom";
import { Panel } from "../../components/ui/Panel";

export function OnboardingPage() {
  return (
    <main className="page">
      <Panel>
        <p className="eyebrow">ATLAS Representative Edition</p>

        <h1>Welcome to Atlas</h1>

        <p className="muted">
          Let's prepare your existing customer portfolio and start selling in a
          few minutes.
        </p>

        <br />

        <h2>Do you already have customer data?</h2>

        <div className="task-list">
          <label>
            <input type="radio" checked readOnly />
            <span>Yes, I have an Excel file.</span>
          </label>

          <label>
            <input type="radio" readOnly />
            <span>No, I want to start from scratch.</span>
          </label>
        </div>

        <br />

        <Link className="btn btn-primary" to="/today">
          Continue
        </Link>
      </Panel>
    </main>
  );
}