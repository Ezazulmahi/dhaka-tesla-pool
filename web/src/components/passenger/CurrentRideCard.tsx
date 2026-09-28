"use client";

import { useState } from "react";
import { api, toApiError } from "@/lib/api";
import type { Ride } from "@/lib/types";
import { km, taka, time } from "@/lib/format";
import { Button, Card, ErrorBanner, Notice } from "../ui";
import { RideStatusBadge } from "../StatusBadge";
import { SeatMap } from "../SeatMap";
import { RideProgress } from "./RideProgress";

const HEADLINE: Record<string, string> = {
  REQUESTED: "Looking for a Tesla heading your way…",
  OPEN: "is on the way to pick you up",
  DRIVER_ARRIVED: "has arrived. Hop in!",
  IN_PROGRESS: "On the road",
};

export function CurrentRideCard({ ride, onChanged }: { ride: Ride; onChanged: (ride: Ride) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCancel = ride.status === "REQUESTED" || ride.status === "MATCHED";
  const pool = ride.pool;
  const headline =
    ride.status === "REQUESTED"
      ? HEADLINE.REQUESTED
      : ride.status === "IN_PROGRESS"
        ? HEADLINE.IN_PROGRESS
        : pool
          ? `${pool.vehicle.name} ${HEADLINE[pool.status] ?? ""}`
          : "";

  async function cancel() {
    setCancelling(true);
    setError(null);
    try {
      const res = await api<{ ride: Ride }>(`/rides/${ride.id}/cancel`, { body: {} });
      onChanged(res.ride);
    } catch (e) {
      setError(toApiError(e).message);
    } finally {
      setCancelling(false);
      setConfirming(false);
    }
  }

  return (
    <Card className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-muted">
            {ride.pickup.name} → {ride.dropoff.name} · {km(ride.distanceM)} · {ride.seats} seat{ride.seats > 1 ? "s" : ""}
          </div>
          <h2 className="mt-1 text-lg font-bold">{headline}</h2>
        </div>
        <RideStatusBadge status={ride.status} />
      </div>

      <RideProgress ride={ride} />

      {pool ? (
        <div className="grid gap-4 rounded-xl bg-surface p-4 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Your Tesla</div>
            <div className="font-semibold">
              {pool.vehicle.name} · <span className="font-normal text-muted">{pool.vehicle.plate}</span>
            </div>
            <div className="text-sm">
              Driver {pool.driver.name} ·{" "}
              <a className="text-brand hover:underline" href={`tel:${pool.driver.phone}`}>
                {pool.driver.phone}
              </a>
            </div>
            <div className="mt-2">
              <SeatMap capacity={pool.capacity} taken={pool.seatsTaken} mine={ride.seats} />
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Sharing with</div>
            {pool.coRiders.length === 0 ? (
              <div className="text-sm text-muted">Nobody yet. Seats are open to riders going your way.</div>
            ) : (
              <ul className="text-sm">
                {pool.coRiders.map((c) => (
                  <li key={c.name + c.dropoff}>
                    <span className="font-medium">{c.name}</span> → {c.dropoff}
                    {c.seats > 1 && ` (${c.seats} seats)`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <Notice>
          Requested at {time(ride.createdAt)}. You&apos;ll join a Tesla leaving {ride.pickup.name} as soon as one fits your
          route. You can cancel for free until the trip starts.
        </Notice>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">Your fare</div>
          <div className="text-xl font-bold">
            up to {taka(ride.fare.estimatedPaisa)}{" "}
            <span className="text-sm font-normal text-muted">· {ride.paymentMethod === "CASH" ? "cash" : "TeslaPay"}</span>
          </div>
          <div className="text-xs text-muted">20% off is applied at drop-off if you shared the ride.</div>
        </div>
        {canCancel &&
          (confirming ? (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={cancelling}>
                Keep ride
              </Button>
              <Button variant="danger" loading={cancelling} onClick={cancel}>
                Yes, cancel
              </Button>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setConfirming(true)}>
              Cancel ride
            </Button>
          ))}
      </div>
      {error && <ErrorBanner message={error} />}
    </Card>
  );
}

/** Shown once, right after a ride ends, so the passenger sees what they paid. */
export function FinishedRideCard({ ride, onDismiss }: { ride: Ride; onDismiss: () => void }) {
  const completed = ride.status === "COMPLETED";
  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-muted">
            {ride.pickup.name} → {ride.dropoff.name}
          </div>
          <h2 className="mt-1 text-lg font-bold">{completed ? "You've arrived. Dhonnobad!" : "Ride cancelled"}</h2>
        </div>
        <RideStatusBadge status={ride.status} />
      </div>
      {completed ? (
        <div className="rounded-xl bg-surface p-4 text-sm">
          <div className="flex justify-between">
            <span>Fare ({ride.seats} seat{ride.seats > 1 ? "s" : ""})</span>
            <span>{taka(ride.fare.estimatedPaisa)}</span>
          </div>
          {!!ride.fare.poolDiscountPaisa && (
            <div className="flex justify-between text-brand">
              <span>Pool discount (shared with {ride.pool?.coRiders.map((c) => c.name).join(", ") || "others"})</span>
              <span>−{taka(ride.fare.poolDiscountPaisa)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-line pt-2 text-base font-bold">
            <span>You paid {ride.paymentMethod === "CASH" ? "(cash)" : "(TeslaPay)"}</span>
            <span>{taka(ride.fare.finalPaisa)}</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">{ride.cancelReason ?? "This ride was cancelled."}</p>
      )}
      <Button onClick={onDismiss} className="w-full">
        Book another ride
      </Button>
    </Card>
  );
}
