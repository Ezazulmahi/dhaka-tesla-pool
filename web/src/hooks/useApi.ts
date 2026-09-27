"use client";

import { useCallback, useEffect, useState } from "react";
import { api, toApiError } from "@/lib/api";

/** One-shot GET with loading / error / reload. `path = null` means "not yet". */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!path) return;
    let active = true;
    api<T>(path)
      .then((d) => {
        if (!active) return;
        setData(d);
        setError(null);
      })
      .catch((e) => active && setError(toApiError(e).message));
    return () => {
      active = false;
    };
  }, [path, version]);

  const reload = useCallback(() => {
    setError(null);
    setVersion((v) => v + 1);
  }, []);

  return { data, error, reload };
}
