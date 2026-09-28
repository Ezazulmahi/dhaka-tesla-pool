"use client";

import type { Pool } from "@/lib/types";
import { dateTime, taka } from "@/lib/format";
import { useSession } from "@/hooks/useSession";
import { useApi } from "@/hooks/useApi";
import { PageShell } from "@/components/AppHeader";
import { Card, EmptyState, ErrorBanner, PageLoader } from "@/components/ui";
import { PoolStatusBadge, RideStatusBadge } from "@/components/StatusBadge";

export default function DriverHistoryPage() {
  const { session, logout } = useSession("DRIVER");
  const history = useApi<{ pools: Pool[] }>(session ? "/driver/pools" : null);

  if (!session) return <PageLoader label="Checking your session…" />;
  const pools = history.data?.pools;

  return (
    <PageShell user={session.user} onLogout={logout}>
      <h1 className="text-xl font-bold">Trip history</h1>
      {history.error ? (
        <ErrorBanner message={history.error} onRetry={history.reload} />
      ) : !pools ? (
        <PageLoader label="Loading trips…" />
      ) : pools.length === 0 ? (
        <EmptyState title="No trips yet">Accepted rides will show up here.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {pools.map((p) => (
            <li key={p.id}>
              <Card className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      From {p.pickup.name} · {p.vehicle.name}
                    </div>
                    <div className="text-xs text-muted">
                      {dateTime(p.createdAt)} · {p.passengers.filter((x) => x.status !== "CANCELLED").length} passenger(s) ·{" "}
                      {p.seatsTaken}/{p.capacity} seats
                    </div>
                  </div>
                  <div className="text-right">
                    <PoolStatusBadge status={p.status} />
                    {p.totalFarePaisa != null && <div className="mt-1 text-sm font-bold">{taka(p.totalFarePaisa)}</div>}
                  </div>
                </div>
                {p.passengers.length > 0 && (
                  <ul className="divide-y divide-line rounded-xl bg-surface text-sm">
                    {p.passengers.map((x) => (
                      <li key={x.rideId} className="flex items-center justify-between gap-3 px-3 py-2">
                        <span>
                          {x.name} → {x.dropoff.name} · {x.seats} seat{x.seats > 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-2">
                          <RideStatusBadge status={x.status} />
                          <span className="w-16 text-right font-medium">{taka(x.fare.finalPaisa)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
