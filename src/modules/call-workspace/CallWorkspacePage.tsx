import { useEffect, useState } from "react";
import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { useWorkspaceHeader } from "../../components/layout/workspaceHeaderContext";
import { Panel } from "../../components/ui/Panel";

import { CustomerWorkspace } from "./CustomerWorkspace";
import { useWorkspaceData } from "./hooks/useWorkspaceData";

/**
 * The single, real Company Working Space. Company Record (CompanyDetailPage)
 * is a separate, non-operational archive screen — it only links here via
 * "Çalışma Alanını Aç". This page owns the one data fetch and feeds
 * CustomerWorkspace via props (no second fetch, no duplicated business
 * logic).
 */
export function CallWorkspacePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] =
    useSearchParams();

  const {
    setWorkspaceHeader,
    clearWorkspaceHeader,
  } = useWorkspaceHeader();

  const companyId =
    searchParams.get("companyId") ??
    undefined;

  const contactId =
    searchParams.get("contactId");

  // Sprint 25.1 / Adım 3 — a Today task's opportunity context (Send
  // Quotation, Follow-up Quotation/Contract). Read directly each render,
  // same as contactId above — unlike openEmail/template below, this
  // doesn't need one-shot/pending semantics or URL cleanup, since
  // CustomerWorkspace only ever reads it once on its own mount.
  const opportunityId =
    searchParams.get("opportunityId");

  // Sprint 25.1 / Adım 2 — Company Detail's "E-posta Gönder" intent
  // (openEmail/template query params). Captured once via a lazy useState
  // initializer — runs exactly once, on the very first render, before
  // `company` has loaded (CustomerWorkspace isn't mounted yet during the
  // loading state below) and before the cleanup effect below strips
  // these params from the URL — so the intent survives the async gap
  // until CustomerWorkspace actually mounts and can consume it. A plain
  // useRef would work the same way but reading `.current` during render
  // (to pass it down as a prop below) is flagged by the
  // rules-of-hooks/react-compiler lint rule; state is the render-safe
  // equivalent here since this value is never mutated after mount.
  const [openEmailIntent] = useState(
    () => ({
      open:
        searchParams.get("openEmail") ===
        "true",
      templateId:
        searchParams.get("template"),
    }),
  );

  useEffect(() => {
    if (!openEmailIntent.open) {
      return;
    }

    // Strips openEmail/template from the URL right away so a later page
    // refresh (which would re-read the URL from scratch) never re-arms
    // this intent — CustomerWorkspace's own mount effect already
    // consumes it, this just prevents the query param itself from being
    // a persistent re-trigger.
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(
          current,
        );

        next.delete("openEmail");
        next.delete("template");

        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    company,
    opportunities,
    timeline,
    reminders,
    emails,
    callNotes,
    aiMemory,
    exhibitions,
    contacts,
    loading,
    error,
    refresh,
  } = useWorkspaceData(companyId);

  useEffect(() => {
    if (!company) {
      clearWorkspaceHeader();
      return;
    }

    setWorkspaceHeader({
      companyName:
        company.company_name,
    });

    return () => {
      clearWorkspaceHeader();
    };
  }, [
    company,
    setWorkspaceHeader,
    clearWorkspaceHeader,
  ]);

  if (loading) {
    return (
      <main className="page sales-workspace">
        <Panel>
          <p className="eyebrow">
            VIAWA Satış Görüşmesi
          </p>

          <h2>
            Çalışma alanı yükleniyor...
          </h2>

          <p className="muted">
            Müşteri bilgileri yükleniyor.
          </p>
        </Panel>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page sales-workspace">
        <Panel>
          <p className="eyebrow">
            VIAWA Satış Görüşmesi
          </p>

          <h2>
            Çalışma alanı yüklenemedi
          </h2>

          <p className="muted">
            {error}
          </p>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              navigate("/companies")
            }
          >
            Firmaları Aç
          </button>
        </Panel>
      </main>
    );
  }

  if (!company) {
    return (
      <main className="page sales-workspace">
        <Panel>
          <p className="eyebrow">
            VIAWA Satış Görüşmesi
          </p>

          <h2>
            Firma seçilmedi
          </h2>

          <p className="muted">
            Çalışma alanını başlatmadan önce
            bir firma seçin.
          </p>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              navigate("/companies")
            }
          >
            Firmaları Aç
          </button>
        </Panel>
      </main>
    );
  }

  return (
    <main className="page sales-workspace">
      <CustomerWorkspace
        // Forces a full remount when switching companies — several of
        // CustomerWorkspace's internal states are now lazily initialized
        // from company-scoped localStorage (approved prices, generated
        // documents); without this key, switching companies without a
        // full page reload would keep serving the previous company's
        // data until the next reload.
        key={company.id}
        company={company}
        opportunities={opportunities}
        timeline={timeline}
        reminders={reminders}
        emails={emails}
        callNotes={callNotes}
        aiMemory={aiMemory}
        exhibitions={exhibitions}
        contacts={contacts}
        initialContactId={contactId}
        initialOpportunityId={
          opportunityId
        }
        initialOpenEmailPanel={
          openEmailIntent.open
        }
        initialEmailPanelTemplateId={
          openEmailIntent.templateId
        }
        onRefresh={refresh}
      />
    </main>
  );
}
