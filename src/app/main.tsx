import React from "react";
import ReactDOM from "react-dom/client";

import { AppErrorBoundary } from "../components/feedback/AppErrorBoundary";
import { ToastProvider } from "../components/feedback/ToastProvider";
import { AppRouter } from "../core/router/AppRouter";
import { AuthProvider } from "../features/auth/AuthProvider";

import "../styles/index.css";

const appEnvironment = import.meta.env.VITE_APP_ENV?.trim().toLowerCase();
const isStaging = appEnvironment === "staging";

if (isStaging) {
  document.title = "[STAGING] VIAWA";
}

ReactDOM.createRoot(
  document.getElementById("root")!,
).render(
  <React.StrictMode>
    {isStaging ? <div className="viawa-staging-banner" role="status">STAGING — TEST DATA ONLY</div> : null}
    <AppErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </ToastProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);
