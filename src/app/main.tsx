import React from "react";
import ReactDOM from "react-dom/client";

import { AppErrorBoundary } from "../components/feedback/AppErrorBoundary";
import { ToastProvider } from "../components/feedback/ToastProvider";
import { AppRouter } from "../core/router/AppRouter";
import { AuthProvider } from "../features/auth/AuthProvider";

import "../styles/index.css";

ReactDOM.createRoot(
  document.getElementById("root")!,
).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </ToastProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);