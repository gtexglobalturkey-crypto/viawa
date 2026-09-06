import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../services/supabase/client";
import { loadGeneratedDocumentHistory } from "../repositories/generatedDocumentHistoryRepository";
import type { GeneratedDocumentRecord } from "../models/GeneratedDocumentRecord";

export function useGeneratedDocumentHistory(companyId: string, userId?: string) {
  const key = `${userId ?? ""}:${companyId}`;
  const currentKey = useRef(key);
  currentKey.current = key;
  const revision = useRef(0);
  const [state, setState] = useState<{ key: string; records: GeneratedDocumentRecord[]; loading: boolean; error: string | null }>({ key, records: [], loading: true, error: null });
  const reload = useCallback(async () => {
    const request = ++revision.current;
    setState((previous) => ({ key, records: previous.key === key ? previous.records : [], loading: true, error: null }));
    try {
      const records = userId ? await loadGeneratedDocumentHistory(supabase, companyId) : [];
      if (currentKey.current === key && request === revision.current) setState({ key, records, loading: false, error: null });
      return records;
    } catch (error) {
      if (currentKey.current === key && request === revision.current) setState({ key, records: [], loading: false, error: "Sözleşme geçmişi yüklenemedi." });
      throw error;
    }
  }, [companyId, userId, key]);
  useEffect(() => { void reload().catch(() => {}); return () => { revision.current++; }; }, [reload]);
  const setRecords = useCallback((update: GeneratedDocumentRecord[] | ((records: GeneratedDocumentRecord[]) => GeneratedDocumentRecord[])) => {
    if (currentKey.current !== key) return;
    setState((previous) => previous.key !== key ? previous : { ...previous, records: typeof update === "function" ? update(previous.records) : update });
  }, [key]);
  return { records: state.key === key ? state.records : [], setRecords, reload, loading: state.key !== key || state.loading, error: state.key === key ? state.error : null };
}
