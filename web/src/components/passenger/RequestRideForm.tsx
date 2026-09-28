"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, toApiError } from "@/lib/api";
import type { Estimate, MatchOutcome, PaymentMethod, Ride, User, Zone } from "@/lib/types";
import { km, taka } from "@/lib/format";
import { Button, Card, cx, ErrorBanner, Field, inputClass, Spinner } from "../ui";

const MAX_SEATS = 3;

export function RequestRideForm({
  user,
  zones,
  onBooked,
}: {
  user: User;
  zones: Zone[];
  onBooked: (ride: Ride, outcome: MatchOutcome) => void;
}) {
  const [pickupZoneId, setPickup] = useState<number | "">("");
  const [dropoffZoneId, setDropoff] = useState<number | "">("");
  const [seats, setSeats] = useState(1);
  const [paymentMethod, setPayment] = useState<PaymentMethod>("CASH");
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = pickupZoneId !== "" && dropoffZoneId !== "" && pickupZoneId !== dropoffZoneId;

  // Live price as soon as the trip is fully described (debounced).
  useEffect(() => {
    if (!complete) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setEstimating(true);
      try {
        const res = await api<{ estimate: Estimate }>("/rides/estimate", { body: { pickupZoneId, dropoffZoneId, seats } });
        if (!cancelled) setEstimate(res.estimate);
      } catch (e) {
        if (!cancelled) setError(toApiError(e).message);
      } finally {
        if (!cancelled) setEstimating(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [complete, pickupZoneId, dropoffZoneId, seats]);

  const shownEstimate = complete ? estimate : null;
  const walletShort = paymentMethod === "TESLAPAY" && shownEstimate && user.walletBalancePaisa < shownEstimate.soloFarePaisa;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!complete) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api<{ ride: Ride; matchOutcome: MatchOutcome }>("/rides", {
        body: { pickupZoneId, dropoffZoneId, seats, paymentMethod },
      });
      onBooked(res.ride, res.matchOutcome);
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  const zoneOptions = zones.map((z) => (
    <option key={z.id} value={z.id}>
      {z.name}
    </option>
  ));

  return (
    <Card>
      <h2 className="text-lg font-bold">Where to, {user.name}?</h2>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pickup zone">
            <select
              className={inputClass}
              value={pickupZoneId}
              onChange={(e) => setPickup(e.target.value ? Number(e.target.value) : "")}
              required
            >
              <option value="">Choose pickup…</option>
              {zoneOptions}
            </select>
          </Field>
          <Field
            label="Destination"
            error={pickupZoneId !== "" && pickupZoneId === dropoffZoneId ? "Pick a different zone than your pickup" : undefined}
          >
            <select
              className={inputClass}
              value={dropoffZoneId}
              onChange={(e) => setDropoff(e.target.value ? Number(e.target.value) : "")}
              required
            >
              <option value="">Choose destination…</option>
              {zoneOptions}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Seats" group>
            <div className="flex gap-2" role="radiogroup" aria-label="Seats">
              {Array.from({ length: MAX_SEATS }, (_, i) => i + 1).map((n) => (
                <button
                  type="button"
                  key={n}
                  role="radio"
                  aria-checked={seats === n}
                  onClick={() => setSeats(n)}
                  className={cx(
                    "flex-1 rounded-xl border py-2.5 text-sm font-semibold",
                    seats === n ? "border-brand bg-brand/10 text-brand-dark" : "border-line bg-white text-muted hover:bg-surface",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Payment" group>
            <div className="flex gap-2" role="radiogroup" aria-label="Payment">
              {(["CASH", "TESLAPAY"] as const).map((m) => (
                <button
                  type="button"
                  key={m}
                  role="radio"
                  aria-checked={paymentMethod === m}
                  onClick={() => setPayment(m)}
                  className={cx(
                    "flex-1 rounded-xl border py-2.5 text-sm font-semibold",
                    paymentMethod === m ? "border-brand bg-brand/10 text-brand-dark" : "border-line bg-white text-muted hover:bg-surface",
                  )}
                >
                  {m === "CASH" ? "Cash" : `TeslaPay · ${taka(user.walletBalancePaisa)}`}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="rounded-xl bg-surface p-4" aria-live="polite">
          {!complete ? (
            <p className="text-sm text-muted">Choose pickup and destination to see your fare.</p>
          ) : estimating && !shownEstimate ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Spinner className="size-4" /> Calculating fare…
            </p>
          ) : shownEstimate ? (
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted">You pay at most</div>
                <div className="text-2xl font-bold">{taka(shownEstimate.soloFarePaisa)}</div>
                <div className="text-xs text-muted">
                  {km(shownEstimate.distanceM)} · ({taka(shownEstimate.baseFarePaisa)} base + {taka(shownEstimate.distanceChargePaisa)}{" "}
                  distance) × {shownEstimate.seats} seat{shownEstimate.seats > 1 ? "s" : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wide text-muted">If you share the Tesla</div>
                <div className="text-lg font-bold text-brand">{taka(shownEstimate.pooledFarePaisa)}</div>
                <div className="text-xs text-muted">20% pool discount</div>
              </div>
            </div>
          ) : null}
        </div>

        {walletShort && (
          <p className="text-sm text-danger">Your TeslaPay balance doesn&apos;t cover this ride. Choose cash or fewer seats.</p>
        )}
        {error && <ErrorBanner message={error} />}
        <Button type="submit" className="w-full" loading={submitting} disabled={!complete || !!walletShort}>
          Request ride
        </Button>
      </form>
    </Card>
  );
}
