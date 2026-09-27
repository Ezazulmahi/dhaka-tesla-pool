"use client";

import { useEffect, useState } from "react";
import { api, toApiError } from "@/lib/api";
import type { RideEvent } from "@/lib/types";
import { EVENT_LABEL, taka, time } from "@/lib/format";
import { ErrorBanner, Spinner } from "./ui";

function detail(e: RideEvent): string | null {
  const d = e.details;
  if (e.type === "RIDE_MATCHED" && typeof d.seatsTaken === "number") return `${d.seatsTaken}/${d.capacity} seats taken`;
  if (e.type === "RIDE_COMPLETED" && typeof d.finalFarePaisa === "number") {
    return d.shared ? `${taka(d.finalFarePaisa)} after ${taka(d.poolDiscountPaisa as number)} pool discount` : taka(d.finalFarePaisa);
  }
  if (e.type === "PAYMENT_CAPTURED" && typeof d.amountPaisa === "number") return taka(d.amountPaisa);
  if (typeof d.reason === "string") return d.reason;
  return null;
}

/** The audit trail for one ride: "explain exactly what happened". */
export function RideTimeline({ rideId }: { rideId: string }) {
  const [events, setEvents] = useState<RideEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ events: RideEvent[] }>(`/rides/${rideId}/events`)
      .then((r) => setEvents(r.events))
      .catch((e) => setError(toApiError(e).message));
  }, [rideId]);

  if (error) return <ErrorBanner message={error} />;
  if (!events) return <Spinner className="size-4 text-muted" />;

  return (
    <ol className="relative ml-2 space-y-3 border-l border-line pl-4">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-brand" />
          <div className="text-sm">
            <span className="font-medium">{EVENT_LABEL[e.type] ?? e.type}</span>
            {e.actor && <span className="text-muted"> · by {e.actor}</span>}
          </div>
          <div className="text-xs text-muted">
            {time(e.at)}
            {detail(e) && ` · ${detail(e)}`}
          </div>
        </li>
      ))}
    </ol>
  );
}
