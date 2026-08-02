import type { ManualFollowUpSelection } from "../components/LiveInteraction";
import type { PriceCalculatedMeta } from "../pricing/components/PriceCalculatorModal";
import type { PriceResult } from "../pricing/models/PriceResult";
import type {
  WorkspaceEmailDraft,
  WorkspaceEmailEvent,
} from "./exhibitionSessionMail";

/**
 * Sprint 25.3 — every fuar the workspace touches gets its own independent
 * "Exhibition Session" of draft (never auto-persisted) state. Switching the
 * sidebar fuar switches which session is active; it never mutates or
 * deletes any other fuar's session. Only the real commit engine
 * (CustomerWorkspace's commitWorkspaceSession) ever turns any of this into
 * a Supabase write, and only for the session that was just committed.
 *
 * `contract`/`callResult` have no dedicated UI yet (no new feature was
 * built for them) — they exist here so the session shape already matches
 * what the upcoming Workspace Sözleşme Akışı and Opportunity Close work
 * will plug into. `mailDraft`/`mailEvents` (Sprint 25.4B) are real and
 * wired to the Workspace Email Panel — see exhibitionSessionMail.ts.
 */
export type ExhibitionSessionDraft = {
  note: string;
  priceResult: {
    result: PriceResult;
    meta: PriceCalculatedMeta;
  } | null;
  nextActivity: ManualFollowUpSelection | null;
  callResult: string | null;
  documentIds: readonly string[];
  mailDraft: WorkspaceEmailDraft | null;
  mailEvents: readonly WorkspaceEmailEvent[];
  contract: null;
};

export const EMPTY_EXHIBITION_SESSION_DRAFT: ExhibitionSessionDraft = {
  note: "",
  priceResult: null,
  nextActivity: null,
  callResult: null,
  documentIds: [],
  mailDraft: null,
  mailEvents: [],
  contract: null,
};

export type ExhibitionSessionStore = Readonly<
  Record<string, ExhibitionSessionDraft>
>;

// Sentinel key for the session the workspace is in before any fuar is
// selected in the sidebar — company/contact info and a general note are
// still usable there (see Sprint 25.2.1), they just aren't tied to a real
// fuar yet.
export const NO_EXHIBITION_SESSION_KEY = "__no_exhibition__";

export function sessionKeyFor(
  exhibitionId: string | null,
): string {
  return exhibitionId ?? NO_EXHIBITION_SESSION_KEY;
}

export function getSessionDraft(
  store: ExhibitionSessionStore,
  exhibitionId: string | null,
): ExhibitionSessionDraft {
  return (
    store[sessionKeyFor(exhibitionId)] ??
    EMPTY_EXHIBITION_SESSION_DRAFT
  );
}

// Patches only the targeted fuar's session — every other key in the store
// is returned untouched (same object references), so this can never leak
// into or clear another fuar's draft.
export function withSessionDraft(
  store: ExhibitionSessionStore,
  exhibitionId: string | null,
  patch: Partial<ExhibitionSessionDraft>,
): ExhibitionSessionStore {
  const key = sessionKeyFor(exhibitionId);
  const current = store[key] ?? EMPTY_EXHIBITION_SESSION_DRAFT;

  return {
    ...store,
    [key]: { ...current, ...patch },
  };
}

// Only ever called after a successful commit, and only for the fuar that
// was actually just committed — every other session is left exactly as it
// was, per Section 7 ("Diğer fuarların draftlarına dokunma").
export function withSessionDraftCleared(
  store: ExhibitionSessionStore,
  exhibitionId: string | null,
): ExhibitionSessionStore {
  const key = sessionKeyFor(exhibitionId);

  if (!(key in store)) {
    return store;
  }

  const next = { ...store };
  delete next[key];
  return next;
}

function isEmptyDraft(
  draft: ExhibitionSessionDraft,
): boolean {
  return (
    draft.note.trim().length === 0 &&
    draft.priceResult === null &&
    draft.nextActivity === null &&
    draft.callResult === null &&
    draft.documentIds.length === 0 &&
    draft.mailDraft === null &&
    draft.mailEvents.length === 0
  );
}

/**
 * Sprint 25.2.1 required that a general note written before any fuar was
 * selected must not be lost once a fuar is picked. Sprint 25.3's stricter
 * per-fuar segregation means that note now lives under
 * NO_EXHIBITION_SESSION_KEY, not under the newly selected fuar's own key —
 * so on the one-time transition from "no fuar" to a real fuar, whatever was
 * drafted there is carried into that fuar's (still fresh) session instead
 * of being stranded. If the target fuar already has its own session (a
 * fuar the user has visited before), that existing session always wins —
 * this never overwrites another fuar's draft.
 */
export function migrateNoExhibitionDraft(
  store: ExhibitionSessionStore,
  targetExhibitionId: string | null,
): ExhibitionSessionStore {
  if (!targetExhibitionId) {
    return store;
  }

  if (targetExhibitionId in store) {
    return store;
  }

  const pending = store[NO_EXHIBITION_SESSION_KEY];

  if (!pending || isEmptyDraft(pending)) {
    return store;
  }

  const next = { ...store };
  delete next[NO_EXHIBITION_SESSION_KEY];
  next[targetExhibitionId] = pending;
  return next;
}
