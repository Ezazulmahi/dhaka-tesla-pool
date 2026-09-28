"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, toApiError } from "@/lib/api";

/**
 * Load now, then refresh every `intervalMs` while the tab is visible.
 * Rides change on a scale of minutes, so a 3s poll is simpler than WebSockets
 * and survives free-tier hosts that drop idle connections (docs/architecture.md §1).
 */
export function usePolling<T>(load: () => Promise<T>, intervalMs = 3000, enabled = true) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  });

  const refresh = useCallback(async () => {
    try {
      const next = await loadRef.current();
      setData(next);
      setError(null);
    } catch (e) {
      setError(toApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs, enabled]);

  return { data, error, loading, refresh, setData };
}
