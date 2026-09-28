"use client";

import { useState } from "react";
import { api, toApiError } from "@/lib/api";
import type { Pool, PoolStatus } from "@/lib/types";
import { taka } from "@/lib/format";
import { Button, Card, ErrorBanner, Notice } from "../ui";
import { PoolStatusBadge, RideStatusBadge } from "../StatusBadge";
import { SeatMap } from "../SeatMap";

// The one next step for each trip status. Keeps the driver's screen to a single big button.
const NEXT: Partial<Record<PoolStatus, { action: string; label: string }>> = {
  OPEN: { action: "arrive", label: "I've arrived at pickup" },
  DRIVER_ARRIVED: { action: "start", label: "Start trip" },
  STARTED: { action: "complete", label: "Complete trip" },
};

export function CurrentTripCard({ pool, onChanged }: { pool: Pool; onChanged: (p: Pool) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = NEXT[pool.status];
  const canCancel = pool.status === "OPEN" || pool.status === "DRIVER_ARRIVED";
  const riders = pool.passengers.filter((p) => p.status !== "CANCELLED");
  const cashRiders = riders.filter((p) => p.paymentMethod === "CASH").map((p) => p.name);

  async function run(action: string) {
    setBusy(action);
    setError(null);
    try {
      const res = await api<{ pool: Pool }>(`/driver/pools/${pool.id}/${action}`, { body: {} });
      onChanged(res.pool);
    } catch (e) {
      setError(toApiError(e).message);
    } finally {
      setBusy(null);
      setConfirmCancel(false);
    }
  }

  return (
    <Card className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">Current trip · pickup in {pool.pickup.name}</div>
          <h2 className="mt-1 text-lg font-bold">
            {riders.length} passenger{riders.length === 1 ? "" : "s"} in {pool.vehicle.name}
          </h2>
          <div className="mt-2">
            <SeatMap capacity={pool.capacity} taken={pool.seatsTaken} />
          </div>
        </div>
        <PoolStatusBadge status={pool.status} />
      </div>

      <ul className="divide-y divide-line rounded-xl border border-line">
        {riders.map((p) => (
          <li key={p.rideId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <div className="font-semibold">
                {p.name} → {p.dropoff.name}
              </div>
              <div className="text-xs text-muted">
                {p.seats} seat{p.seats > 1 ? "s" : ""} ·{" "}
                <a className="hover:underline" href={`tel:${p.phone}`}>
                  {p.phone}
                </a>{" "}
                · {p.paymentMethod === "CASH" ? "Cash" : "TeslaPay"}
              </div>
            </div>
            <div className="text-right">
              <RideStatusBadge status={p.status} />
              <div className="mt-1 text-sm font-semibold">
                {p.fare.finalPaisa != null ? taka(p.fare.finalPaisa) : `≤ ${taka(p.fare.estimatedPaisa)}`}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {pool.status !== "STARTED" && pool.seatsFree > 0 && (
        <Notice>
          {pool.seatsFree} seat{pool.seatsFree > 1 ? "s" : ""} still free. Passengers heading your way from {pool.pickup.name} can
          join until you start the trip.
        </Notice>
      )}
      {/* Fares are settled by the API at completion (pool discount included), so the UI doesn't guess them. */}
      {pool.status === "STARTED" && cashRiders.length > 0 && (
        <Notice tone="warn">
          Collect cash from {cashRiders.join(" and ")}. Exact fares are shown when you complete the trip.
        </Notice>
      )}

      <div className="flex flex-wrap gap-2">
        {next && (
          <Button className="flex-1" loading={busy === next.action} disabled={!!busy} onClick={() => run(next.action)}>
            {next.label}
          </Button>
        )}
        {canCancel &&
          (confirmCancel ? (
            <>
              <Button variant="ghost" onClick={() => setConfirmCancel(false)} disabled={!!busy}>
                Keep trip
              </Button>
              <Button variant="danger" loading={busy === "cancel"} onClick={() => run("cancel")}>
                Yes, cancel. Passengers go back in the queue
              </Button>
            </>
          ) : (
            <Button variant="danger" onClick={() => setConfirmCancel(true)} disabled={!!busy}>
              Cancel trip
            </Button>
          ))}
      </div>
      {error && <ErrorBanner message={error} />}
    </Card>
  );
}

/** Shown after completing, so Jashim sees what each passenger paid. */
export function CompletedTripCard({ pool, onDismiss }: { pool: Pool; onDismiss: () => void }) {
  const riders = pool.passengers.filter((p) => p.status === "COMPLETED");
  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between">
        <h2 className="text-lg font-bold">Trip complete. Everyone dropped off.</h2>
        <PoolStatusBadge status={pool.status} />
      </div>
      <ul className="space-y-1 text-sm">
        {riders.map((p) => (
          <li key={p.rideId} className="flex justify-between">
            <span>
              {p.name} → {p.dropoff.name} ({p.paymentMethod === "CASH" ? "cash" : "TeslaPay"})
              {!!p.fare.poolDiscountPaisa && <span className="text-brand"> · pooled −{taka(p.fare.poolDiscountPaisa)}</span>}
            </span>
            <span className="font-semibold">{taka(p.fare.finalPaisa)}</span>
          </li>
        ))}
        <li className="flex justify-between border-t border-line pt-2 text-base font-bold">
          <span>Trip total</span>
          <span>{taka(pool.totalFarePaisa)}</span>
        </li>
      </ul>
      <Button className="w-full" onClick={onDismiss}>
        Back to requests
      </Button>
    </Card>
  );
}
