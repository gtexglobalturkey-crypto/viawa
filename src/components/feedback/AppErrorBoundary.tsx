import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<
  Props,
  State
> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError(): State {
    return {
      hasError: true,
    };
  }

  componentDidCatch(
    error: Error,
    errorInfo: ErrorInfo,
  ) {
    console.error(
      "ATLAS application error:",
      error,
      errorInfo,
    );
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-error-boundary">
          <section className="app-error-card">
            <div className="app-error-icon">
              <AlertTriangle size={30} />
            </div>

            <p className="eyebrow">ATLAS SYSTEM</p>

            <h1>Something went wrong</h1>

            <p>
              The application encountered an unexpected
              error. Your saved CRM data has not been
              deleted.
            </p>

            <button
              type="button"
              onClick={this.handleReload}
            >
              <RefreshCw size={17} />

              Reload application
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}