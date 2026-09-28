"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Pool, Vehicle, WaitingRequest, Zone } from "@/lib/types";
import { useSession } from "@/hooks/useSession";
import { usePolling } from "@/hooks/usePolling";
import { useApi } from "@/hooks/useApi";
import { PageShell } from "@/components/AppHeader";
import { ErrorBanner, PageLoader } from "@/components/ui";
import { AvailabilityCard } from "@/components/driver/AvailabilityCard";
import { CompletedTripCard, CurrentTripCard } from "@/components/driver/CurrentTripCard";
import { RequestFeed } from "@/components/driver/RequestFeed";

export default function DriverPage() {
  const { session, logout } = useSession("DRIVER");
  const zones = useApi<{ zones: Zone[] }>("/zones");
  // Latest availability from PATCH responses; falls back to what /auth/me said.
  const [vehicleUpdate, setVehicleUpdate] = useState<Vehicle | null>(null);
  const [completed, setCompleted] = useState<Pool | null>(null);

  const trip = usePolling(
    () => api<{ pool: Pool | null }>("/driver/pools/current").then((r) => r.pool),
    3000,
    !!session,
  );
  const feed = usePolling(() => api<{ online: boolean; requests: WaitingRequest[] }>("/driver/requests"), 3000, !!session);

  if (!session) return <PageLoader label="Checking your session…" />;
  const vehicle = vehicleUpdate ?? session.vehicle;
  if (!vehicle) {
    return (
      <PageShell user={session.user} onLogout={logout}>
        <ErrorBanner message="No Tesla is registered to your account yet. Contact the Tesla Pool team." />
      </PageShell>
    );
  }

  const pool = trip.data ?? null;
  const zoneName = zones.data?.zones.find((z) => z.id === vehicle.currentZoneId)?.name;
  const refreshAll = () => {
    void trip.refresh();
    void feed.refresh();
  };

  return (
    <PageShell user={session.user} onLogout={logout}>
      {zones.data ? (
        <AvailabilityCard
          vehicle={vehicle}
          zones={zones.data.zones}
          lockedZone={!!pool}
          onChange={(v) => {
            setVehicleUpdate(v);
            void feed.refresh();
          }}
        />
      ) : zones.error ? (
        <ErrorBanner message={zones.error} onRetry={zones.reload} />
      ) : (
        <PageLoader label="Loading zones…" />
      )}

      {(trip.error || feed.error) && (
        <ErrorBanner message={(trip.error ?? feed.error)!.message} onRetry={refreshAll} />
      )}

      {completed && !pool && <CompletedTripCard pool={completed} onDismiss={() => setCompleted(null)} />}

      {trip.loading ? (
        <PageLoader label="Loading your trip…" />
      ) : pool ? (
        <CurrentTripCard
          pool={pool}
          onChanged={(p) => {
            if (p.status === "COMPLETED") setCompleted(p);
            trip.setData(p.status === "COMPLETED" || p.status === "CANCELLED" ? null : p);
            void feed.refresh();
          }}
        />
      ) : null}

      {feed.data && pool?.status !== "STARTED" && (
        <RequestFeed
          requests={feed.data.requests}
          online={feed.data.online}
          zoneName={zoneName}
          hasTrip={!!pool}
          onAccepted={(p) => {
            setCompleted(null);
            trip.setData(p);
            void feed.refresh();
          }}
        />
      )}
    </PageShell>
  );
}
