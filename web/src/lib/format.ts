import type { PoolStatus, RideStatus } from "./types";

/** Money arrives as integer paisa; only the display layer ever divides by 100. */
export const taka = (paisa: number | null | undefined) =>
  paisa == null ? "—" : `৳${(paisa / 100).toFixed(2)}`;

export const km = (m: number) => `${(m / 1000).toFixed(1)} km`;

export const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—";

export const dateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—";

export const RIDE_STATUS_LABEL: Record<RideStatus, string> = {
  REQUESTED: "Waiting for a Tesla",
  MATCHED: "Matched",
  IN_PROGRESS: "On the way",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const POOL_STATUS_LABEL: Record<PoolStatus, string> = {
  OPEN: "Heading to pickup",
  DRIVER_ARRIVED: "Driver has arrived",
  STARTED: "Trip in progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const EVENT_LABEL: Record<string, string> = {
  RIDE_REQUESTED: "Ride requested",
  POOL_CREATED: "Driver accepted, trip opened",
  RIDE_MATCHED: "Matched to a Tesla",
  AUTO_MATCH_LOST_RACE: "Last seat taken moments earlier",
  POOL_DRIVER_ARRIVED: "Driver arrived at pickup",
  POOL_STARTED: "Trip started",
  RIDE_STARTED: "Passenger on board",
  POOL_COMPLETED: "Trip completed",
  RIDE_COMPLETED: "Dropped off, fare settled",
  PAYMENT_CAPTURED: "Paid with TeslaPay",
  PAYMENT_FAILED_COLLECT_CASH: "TeslaPay failed, cash collected",
  RIDE_CANCELLED: "Ride cancelled",
  RIDE_REQUEUED: "Driver cancelled, back in the queue",
  POOL_CANCELLED: "Trip cancelled",
};
