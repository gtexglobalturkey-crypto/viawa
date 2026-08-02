import {
  lazy,
  Suspense,
} from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useSearchParams,
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

const CommunicationCenterPage = lazy(async () => {
  const module = await import(
    "../../modules/communication-center/CommunicationCenterPage"
  );

  return {
    default: module.CommunicationCenterPage,
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

const ExhibitionRepositoryPage = lazy(
  async () => {
    const module = await import(
      "../../modules/exhibition-repository/ExhibitionRepositoryPage"
    );

    return {
      default:
        module.ExhibitionRepositoryPage,
    };
  },
);

// Sprint 25.1 / Adım 4 — CommunicationPage is no longer rendered for any
// user. This is the one remaining reason /communication still exists as
// a route: a stale bookmark/link must still land the user in the right
// place (the Workspace Email Panel) instead of a dead page. Same 8-item
// catalog as WorkspaceEmailPanel.tsx's WORKSPACE_EMAIL_TEMPLATE_IDS /
// the old CommunicationPage.tsx's VALID_TEMPLATE_IDS — duplicated here
// rather than imported, matching how this list is already deliberately
// duplicated across those two files (see WorkspaceEmailPanel.tsx's own
// comment on why).
const LEGACY_COMMUNICATION_VALID_TEMPLATE_IDS = [
  "Information Package",
  "Exhibition Presentation",
  "Quotation",
  "Revised Quotation",
  "Contract",
  "Visa Invitation",
  "Visitor Invitation",
  "Thank You",
];

function LegacyCommunicationRedirect() {
  const [searchParams] = useSearchParams();

  const companyId =
    searchParams.get("companyId");

  // No companyId at all — there is nothing for the Workspace to open.
  // The old CommunicationPage showed an inline "Müşteri seçilmedi"
  // state for this; since that page no longer renders, this falls back
  // to Today instead of a blank/broken Workspace.
  if (!companyId) {
    return (
      <Navigate to="/today" replace />
    );
  }

  const opportunityId =
    searchParams.get("opportunityId");

  const requestedTemplate =
    searchParams.get("template");

  const templateId =
    requestedTemplate &&
    LEGACY_COMMUNICATION_VALID_TEMPLATE_IDS.includes(
      requestedTemplate,
    )
      ? requestedTemplate
      : "Information Package";

  const params = new URLSearchParams({
    companyId,
    openEmail: "true",
    template: templateId,
  });

  if (opportunityId) {
    params.set(
      "opportunityId",
      opportunityId,
    );
  }

  return (
    <Navigate
      to={`/call?${params.toString()}`}
      replace
    />
  );
}

function RouteLoadingState() {
  return (
    <main className="page">
      <Panel>
        <p className="eyebrow">
          VIAWA CRM
        </p>

        <h2>
          Çalışma alanı yükleniyor...
        </h2>

        <p className="muted">
          İstenen modül hazırlanıyor.
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
          path="/companies/:id/edit"
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
          element={
            <LegacyCommunicationRedirect />
          }
        />

        <Route
          path="/communication-center"
          element={<CommunicationCenterPage />}
        />

        <Route
          path="/reference-data"
          element={<MasterDataPage />}
        />

        <Route
          path="/exhibitions/:id/repository"
          element={
            <ExhibitionRepositoryPage />
          }
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