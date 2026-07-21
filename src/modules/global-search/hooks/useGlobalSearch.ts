import { useEffect, useMemo, useState } from "react";

import type { SearchResult } from "../models/searchResult";
import { searchAtlas } from "../services/searchService";

export function useGlobalSearch(query: string) {
  const [results, setResults] =
    useState<SearchResult[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const normalizedQuery = query.trim();

  useEffect(() => {
    if (!normalizedQuery) {
      return;
    }

    let isActive = true;

    const timeoutId = window.setTimeout(() => {
      async function runSearch() {
        try {
          setLoading(true);
          setError(null);

          const searchResults =
            await searchAtlas(normalizedQuery);

          if (isActive) {
            setResults(searchResults);
          }
        } catch (searchError) {
          console.error(
            "Global search error:",
            searchError,
          );

          if (isActive) {
            setResults([]);
            setError(
              "Arama sonuçları yüklenemedi.",
            );
          }
        } finally {
          if (isActive) {
            setLoading(false);
          }
        }
      }

      void runSearch();
    }, 250);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [normalizedQuery]);

  const visibleResults = useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }

    return results;
  }, [normalizedQuery, results]);

  return {
    results: visibleResults,
    loading:
      normalizedQuery.length > 0 && loading,
    error,
  };
}