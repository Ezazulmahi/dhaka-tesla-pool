"use client";

import { useState } from "react";
import { api, toApiError } from "@/lib/api";
import type { Pool, WaitingRequest } from "@/lib/types";
import { km, taka, time } from "@/lib/format";
import { Button, Card, EmptyState, ErrorBanner } from "../ui";

export function RequestFeed({
  requests,
  online,
  zoneName,
  hasTrip,
  onAccepted,
}: {
  requests: WaitingRequest[];
  online: boolean;
  zoneName?: string;
  hasTrip: boolean;
  onAccepted: (pool: Pool) => void;
}) {
  const [accepting, setAccepting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function accept(id: string) {
    setAccepting(id);
    setError(null);
    try {
      const res = await api<{ pool: Pool }>(`/driver/requests/${id}/accept`, { body: {} });
      onAccepted(res.pool);
    } catch (e) {
      // e.g. RIDE_ALREADY_TAKEN when another Tesla got there first, which is normal, not a crash.
      setError(toApiError(e).message);
    } finally {
      setAccepting(null);
    }
  }

  if (!online) {
    return <EmptyState title="You're offline">Choose your zone and go online to see passengers waiting nearby.</EmptyState>;
  }

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">
        {hasTrip ? "Passengers who fit your trip" : `Waiting in ${zoneName ?? "your zone"}`}
      </h2>
      {error && <ErrorBanner message={error} />}
      {requests.length === 0 ? (
        <EmptyState title="No one waiting right now">
          {hasTrip
            ? "Nobody else waiting has a route that fits your current passengers."
            : "New requests appear here automatically."}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => (
            <li key={r.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="font-semibold">
                    {r.passengerName} → {r.dropoff.name}
                  </div>
                  <div className="text-xs text-muted">
                    from {r.pickup.name} · {km(r.distanceM)} · {r.seats} seat{r.seats > 1 ? "s" : ""} · waiting since{" "}
                    {time(r.requestedAt)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">≤ {taka(r.estimatedFarePaisa)}</span>
                  <Button loading={accepting === r.id} disabled={!!accepting} onClick={() => accept(r.id)}>
                    {hasTrip ? "Add to trip" : "Accept"}
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
