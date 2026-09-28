"use client";

import { useState } from "react";
import { api, toApiError } from "@/lib/api";
import type { Vehicle, Zone } from "@/lib/types";
import { Button, Card, cx, ErrorBanner, inputClass } from "../ui";

export function AvailabilityCard({
  vehicle,
  zones,
  lockedZone,
  onChange,
}: {
  vehicle: Vehicle;
  zones: Zone[];
  /** True while a trip is active: the zone can't change and going offline is refused. */
  lockedZone: boolean;
  onChange: (v: Vehicle) => void;
}) {
  const [zoneId, setZoneId] = useState<number | "">(vehicle.currentZoneId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(online: boolean, zone: number | "" = zoneId) {
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ vehicle: Vehicle }>("/driver/availability", {
        method: "PATCH",
        body: { online, ...(zone !== "" ? { zoneId: zone } : {}) },
      });
      onChange(res.vehicle);
    } catch (e) {
      setError(toApiError(e).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">Your Tesla</div>
          <div className="text-lg font-bold">
            {vehicle.name} <span className="text-sm font-normal text-muted">· {vehicle.plate} · {vehicle.capacity} seats</span>
          </div>
        </div>
        <span
          className={cx(
            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold",
            vehicle.isOnline ? "bg-brand/10 text-brand-dark" : "bg-surface text-muted",
          )}
        >
          <span className={cx("size-2 rounded-full", vehicle.isOnline ? "animate-pulse bg-brand" : "bg-muted")} />
          {vehicle.isOnline ? "Online" : "Offline"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex-1">
          <span className="sr-only">Waiting zone</span>
          <select
            className={inputClass}
            value={zoneId}
            disabled={lockedZone || saving}
            onChange={(e) => {
              const z = e.target.value ? Number(e.target.value) : "";
              setZoneId(z);
              if (vehicle.isOnline && z !== "") void update(true, z);
            }}
          >
            <option value="">Choose the zone you&apos;re waiting in…</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </label>
        {vehicle.isOnline ? (
          <Button variant="secondary" loading={saving} disabled={lockedZone} onClick={() => update(false)}>
            Go offline
          </Button>
        ) : (
          <Button loading={saving} disabled={zoneId === ""} onClick={() => update(true)}>
            Go online
          </Button>
        )}
      </div>
      {lockedZone && <p className="text-xs text-muted">Finish or cancel your current trip to change zone or go offline.</p>}
      {error && <ErrorBanner message={error} />}
    </Card>
  );
}
