"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, toApiError } from "@/lib/api";
import type { Role, User, Vehicle } from "@/lib/types";

export const HOME_FOR: Record<Role, string> = { PASSENGER: "/passenger", DRIVER: "/driver" };

interface Session {
  user: User;
  vehicle: Vehicle | null;
}

/**
 * Who is signed in. Pages that need a role redirect: no session -> /login,
 * wrong role -> that user's own dashboard. The API enforces the same rules;
 * this only keeps people off screens that would 403 anyway.
 */
export function useSession(requiredRole?: Role) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    api<Session>("/auth/me")
      .then((s) => {
        if (!active) return;
        if (requiredRole && s.user.role !== requiredRole) {
          router.replace(HOME_FOR[s.user.role]);
          return;
        }
        setSession(s);
        setError(null);
      })
      .catch((e) => {
        if (!active) return;
        const err = toApiError(e);
        if (err.status === 401) router.replace("/login");
        else setError(err);
      });
    return () => {
      active = false;
    };
  }, [requiredRole, router, version]);

  /** Re-read the session, e.g. after a TeslaPay payment changed the wallet. */
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
  }, [router]);

  return { session, error, refresh, logout };
}
