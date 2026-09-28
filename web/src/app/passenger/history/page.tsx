"use client";

import { useState } from "react";
import Link from "next/link";
import type { Ride } from "@/lib/types";
import { dateTime, km, taka } from "@/lib/format";
import { useSession } from "@/hooks/useSession";
import { useApi } from "@/hooks/useApi";
import { PageShell } from "@/components/AppHeader";
import { Card, EmptyState, ErrorBanner, PageLoader } from "@/components/ui";
import { RideStatusBadge } from "@/components/StatusBadge";
import { RideTimeline } from "@/components/RideTimeline";

export default function PassengerHistoryPage() {
  const { session, logout } = useSession("PASSENGER");
  const history = useApi<{ rides: Ride[] }>(session ? "/rides" : null);
  const [open, setOpen] = useState<string | null>(null);

  if (!session) return <PageLoader label="Checking your session…" />;
  const rides = history.data?.rides;

  return (
    <PageShell user={session.user} onLogout={logout}>
      <h1 className="text-xl font-bold">Your rides</h1>
      {history.error ? (
        <ErrorBanner message={history.error} onRetry={history.reload} />
      ) : !rides ? (
        <PageLoader label="Loading history…" />
      ) : rides.length === 0 ? (
        <EmptyState title="No rides yet">
          <Link href="/passenger" className="font-semibold text-brand hover:underline">
            Book your first ride
          </Link>
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {rides.map((r) => (
            <li key={r.id}>
              <Card className="p-4">
                <button
                  className="flex w-full items-start justify-between gap-3 text-left"
                  onClick={() => setOpen(open === r.id ? null : r.id)}
                  aria-expanded={open === r.id}
                >
                  <div>
                    <div className="font-semibold">
                      {r.pickup.name} → {r.dropoff.name}
                    </div>
                    <div className="text-xs text-muted">
                      {dateTime(r.createdAt)} · {km(r.distanceM)} · {r.seats} seat{r.seats > 1 ? "s" : ""}
                      {r.pool?.vehicle.name && ` · ${r.pool.vehicle.name} with ${r.pool.driver.name}`}
                    </div>
                    <div className="mt-1 text-xs font-medium text-brand">
                      {open === r.id ? "Hide timeline" : "Show what happened"}
                    </div>
                  </div>
                  <div className="shrink-0 space-y-1 text-right">
                    <RideStatusBadge status={r.status} />
                    <div className="text-sm font-semibold">
                      {r.status === "COMPLETED"
                        ? taka(r.fare.finalPaisa)
                        : r.status === "CANCELLED"
                          ? "—"
                          : `≤ ${taka(r.fare.estimatedPaisa)}`}
                    </div>
                    {!!r.fare.poolDiscountPaisa && (
                      <div className="text-xs text-brand">pooled −{taka(r.fare.poolDiscountPaisa)}</div>
                    )}
                  </div>
                </button>
                {open === r.id && (
                  <div className="mt-4 border-t border-line pt-4">
                    <RideTimeline rideId={r.id} />
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
