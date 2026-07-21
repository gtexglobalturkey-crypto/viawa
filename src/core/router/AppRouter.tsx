import {
  lazy,
  Suspense,
} from "react";
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { AppShell } from "../../components/layout/AppShell";
import { Panel } from "../../components/ui/Panel";
import { ProtectedApp } from "../../features/auth/ProtectedApp";

const TodayPage = lazy(async () => {
  const module = await import(
    "../../modules/today/TodayPage"
  );

  return {
    default: module.TodayPage,
  };
});

const CompaniesPage = lazy(async () => {
  const module = await import(
    "../../modules/companies/CompaniesPage"
  );

  return {
    default: module.CompaniesPage,
  };
});

const NewCompanyPage = lazy(async () => {
  const module = await import(
    "../../modules/companies/NewCompanyPage"
  );

  return {
    default: module.NewCompanyPage,
  };
});

const CompanyDetailPage = lazy(async () => {
  const module = await import(
    "../../modules/companies/CompanyDetailPage"
  );

  return {
    default: module.CompanyDetailPage,
  };
});

const ImportPortfolioPage = lazy(async () => {
  const module = await import(
    "../../modules/import-portfolio/ImportPortfolioPage"
  );

  return {
    default: module.ImportPortfolioPage,
  };
});

const CallWorkspacePage = lazy(async () => {
  const module = await import(
    "../../modules/call-workspace/CallWorkspacePage"
  );

  return {
    default: module.CallWorkspacePage,
  };
});

const CommunicationPage = lazy(async () => {
  const module = await import(
    "../../modules/communication/CommunicationPage"
  );

  return {
    default: module.CommunicationPage,
  };
});

const OnboardingPage = lazy(async () => {
  const module = await import(
    "../../modules/onboarding/OnboardingPage"
  );

  return {
    default: module.OnboardingPage,
  };
});

const MasterDataPage = lazy(async () => {
  const module = await import(
    "../../modules/master-data/MasterDataPage"
  );

  return {
    default: module.MasterDataPage,
  };
});

function RouteLoadingState() {
  return (
    <main className="page">
      <Panel>
        <p className="eyebrow">
          Atlas CRM
        </p>

        <h2>
          Loading workspace...
        </h2>

        <p className="muted">
          The requested module is being
          prepared.
        </p>
      </Panel>
    </main>
  );
}

function AppRoutes() {
  return (
    <Suspense
      fallback={<RouteLoadingState />}
    >
      <Routes>
        <Route
          path="/"
          element={<TodayPage />}
        />

        <Route
          path="/today"
          element={<TodayPage />}
        />

        <Route
          path="/onboarding"
          element={<OnboardingPage />}
        />

        <Route
          path="/companies"
          element={<CompaniesPage />}
        />

        <Route
          path="/companies/new"
          element={<NewCompanyPage />}
        />

        <Route
          path="/companies/import"
          element={<ImportPortfolioPage />}
        />

        <Route
          path="/companies/:id"
          element={<CompanyDetailPage />}
        />

        <Route
          path="/call"
          element={<CallWorkspacePage />}
        />

        <Route
          path="/communication"
          element={<CommunicationPage />}
        />

        <Route
          path="/reference-data"
          element={<MasterDataPage />}
        />
      </Routes>
    </Suspense>
  );
}

function RoutedApplication() {
  const location = useLocation();

  return (
    <ProtectedApp>
      <AppShell key={location.key}>
        <AppRoutes />
      </AppShell>
    </ProtectedApp>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <RoutedApplication />
    </BrowserRouter>
  );
}