"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { MatchOutcome, Ride, Zone } from "@/lib/types";
import { useSession } from "@/hooks/useSession";
import { usePolling } from "@/hooks/usePolling";
import { useApi } from "@/hooks/useApi";
import { PageShell } from "@/components/AppHeader";
import { ErrorBanner, Notice, PageLoader } from "@/components/ui";
import { RequestRideForm } from "@/components/passenger/RequestRideForm";
import { CurrentRideCard, FinishedRideCard } from "@/components/passenger/CurrentRideCard";

const OUTCOME_MESSAGE: Record<MatchOutcome, { tone: "success" | "info" | "warn"; text: string }> = {
  JOINED_POOL: { tone: "success", text: "You're in! You joined a Tesla already heading your way." },
  WAITING_FOR_DRIVER: { tone: "info", text: "Ride requested. We'll match you with the next Tesla in your zone." },
  LAST_SEAT_TAKEN: {
    tone: "warn",
    text: "Someone grabbed the last seat a moment before you. You're still in the queue for the next Tesla.",
  },
};

export default function PassengerPage() {
  const { session, logout, refresh: refreshSession } = useSession("PASSENGER");
  const zones = useApi<{ zones: Zone[] }>("/zones");
  const [outcome, setOutcome] = useState<MatchOutcome | null>(null);
  const [finished, setFinished] = useState<Ride | null>(null);
  // The ride we are tracking. When it stops being "current" (completed or cancelled
  // elsewhere, e.g. by the driver) we fetch and show its final state once.
  const trackedId = useRef<string | null>(null);

  const current = usePolling(
    () => api<{ ride: Ride | null }>("/rides/current").then((r) => r.ride),
    3000,
    !!session,
  );
  const ride = current.data ?? null;

  useEffect(() => {
    if (ride) {
      trackedId.current = ride.id;
      return;
    }
    if (current.data !== null || !trackedId.current) return;
    const id = trackedId.current;
    trackedId.current = null;
    api<{ ride: Ride }>(`/rides/${id}`)
      .then((r) => {
        setOutcome(null);
        setFinished(r.ride);
        refreshSession(); // wallet balance may have changed
      })
      .catch(() => undefined);
  }, [ride, current.data, refreshSession]);

  if (!session) return <PageLoader label="Checking your session…" />;

  return (
    <PageShell user={session.user} onLogout={logout}>
      {current.error && <ErrorBanner message={current.error.message} onRetry={current.refresh} />}

      {/* The booking outcome only matters until the ride moves on (e.g. waiting -> matched). */}
      {outcome && ride && (outcome === "JOINED_POOL" ? ride.status === "MATCHED" : ride.status === "REQUESTED") && <Notice tone={OUTCOME_MESSAGE[outcome].tone}>{OUTCOME_MESSAGE[outcome].text}</Notice>}

      {current.loading ? (
        <PageLoader label="Loading your ride…" />
      ) : ride ? (
        <CurrentRideCard
          ride={ride}
          onChanged={(r) => {
            if (r.status === "CANCELLED") {
              trackedId.current = null;
              setOutcome(null);
              setFinished(r);
              current.setData(null);
            } else {
              current.setData(r);
            }
          }}
        />
      ) : finished ? (
        <FinishedRideCard ride={finished} onDismiss={() => setFinished(null)} />
      ) : zones.error ? (
        <ErrorBanner message={zones.error} onRetry={zones.reload} />
      ) : !zones.data ? (
        <PageLoader label="Loading Dhaka zones…" />
      ) : (
        <RequestRideForm
          user={session.user}
          zones={zones.data.zones}
          onBooked={(r, o) => {
            setOutcome(o);
            trackedId.current = r.id;
            current.setData(r);
          }}
        />
      )}
    </PageShell>
  );
}
