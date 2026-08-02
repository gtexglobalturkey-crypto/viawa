/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getExhibitions } from "../../../services/supabase/exhibitionService";
import type { Exhibition as DatabaseExhibition } from "../../../types/database";
import type { Exhibition } from "../models/Exhibition";
import {
  loadExhibitions,
  loadSelectedExhibitionId,
  saveExhibitions,
  saveSelectedExhibitionId,
} from "../storage/exhibitionStorage";

type ExhibitionSelectionContextValue = {
  exhibitions: Exhibition[];
  setExhibitions: (
    exhibitions: Exhibition[],
  ) => void;

  selectedExhibitionId: string | null;
  setSelectedExhibitionId: (
    id: string | null,
  ) => void;
  exhibitionsLoading: boolean;
  exhibitionsError: string | null;
};

const ExhibitionSelectionContext =
  createContext<
    | ExhibitionSelectionContextValue
    | undefined
  >(undefined);

type Props = {
  children: ReactNode;
};

function mapDatabaseExhibition(
  row: DatabaseExhibition,
  cachedById: ReadonlyMap<string, Exhibition>,
): Exhibition | null {
  const id = row.id.trim();
  const name = row.name.trim();

  if (!id || !name) {
    return null;
  }

  const cached = cachedById.get(id);

  return {
    id,
    name,
    shortName:
      cached?.shortName.trim() || name,
    city: row.city?.trim() || undefined,
    country:
      row.country?.trim() || undefined,
    startDate: row.start_date || undefined,
    endDate: row.end_date || undefined,
    createdAt: row.created_at,
  };
}

// Shared across the sidebar (which lists/selects a fuar) and the Company
// Workspace page (which reads the selection to render Exhibition
// Workspace) — the two live in different parts of the component tree, so
// a context is the simplest way to connect them without prop-drilling
// through the router.
export function ExhibitionSelectionProvider({
  children,
}: Props) {
  const [exhibitions, setExhibitions] =
    useState<Exhibition[]>(() =>
      loadExhibitions(),
    );

  const [exhibitionsLoading, setExhibitionsLoading] =
    useState(true);

  const [exhibitionsError, setExhibitionsError] =
    useState<string | null>(null);

  const [
    selectedExhibitionId,
    setSelectedExhibitionId,
  ] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const cachedExhibitions = loadExhibitions();
    const cachedById = new Map(
      cachedExhibitions.map((exhibition) => [
        exhibition.id,
        exhibition,
      ]),
    );
    const storedSelection =
      loadSelectedExhibitionId();

    async function loadSupabaseExhibitions() {
      setExhibitionsLoading(true);
      setExhibitionsError(null);

      try {
        const rows = await getExhibitions();
        const mapped = rows
          .map((row) =>
            mapDatabaseExhibition(row, cachedById),
          )
          .filter(
            (exhibition): exhibition is Exhibition =>
              exhibition !== null,
          );

        if (!isCurrent) {
          return;
        }

        setExhibitions(mapped);
        saveExhibitions(mapped);
        setSelectedExhibitionId((current) => {
          const candidate = current ?? storedSelection;
          const nextSelection =
            candidate &&
            mapped.some(
              (exhibition) =>
                exhibition.id === candidate,
            )
              ? candidate
              : null;

          saveSelectedExhibitionId(nextSelection);
          return nextSelection;
        });
      } catch (error) {
        if (!isCurrent) {
          return;
        }

        console.error(
          "Supabase exhibition list could not be loaded:",
          error,
        );
        setExhibitions(cachedExhibitions);
        setSelectedExhibitionId(
          storedSelection &&
            cachedExhibitions.some(
              (exhibition) =>
                exhibition.id === storedSelection,
            )
            ? storedSelection
            : null,
        );
        setExhibitionsError(
          "Fuarlar yüklenemedi. Lütfen tekrar deneyin.",
        );
      } finally {
        if (isCurrent) {
          setExhibitionsLoading(false);
        }
      }
    }

    void loadSupabaseExhibitions();

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (!exhibitionsLoading) {
      saveSelectedExhibitionId(
        selectedExhibitionId,
      );
    }
  }, [exhibitionsLoading, selectedExhibitionId]);

  const value = useMemo(
    () => ({
      exhibitions,
      setExhibitions,
      selectedExhibitionId,
      setSelectedExhibitionId,
      exhibitionsLoading,
      exhibitionsError,
    }),
    [
      exhibitions,
      exhibitionsError,
      exhibitionsLoading,
      selectedExhibitionId,
    ],
  );

  return (
    <ExhibitionSelectionContext.Provider
      value={value}
    >
      {children}
    </ExhibitionSelectionContext.Provider>
  );
}

export function useExhibitionSelection() {
  const context = useContext(
    ExhibitionSelectionContext,
  );

  if (!context) {
    throw new Error(
      "useExhibitionSelection must be used inside ExhibitionSelectionProvider.",
    );
  }

  return context;
}
