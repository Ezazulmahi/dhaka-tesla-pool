import type { Ride } from "@/lib/types";
import { cx } from "../ui";

const STEPS = ["Finding a Tesla", "Tesla on the way", "Driver arrived", "On the road", "Dropped off"];

/** Collapses the two lifecycles (ride + pool) into one line a passenger understands. */
export function stepFor(ride: Ride): number {
  if (ride.status === "COMPLETED") return 4;
  if (ride.status === "IN_PROGRESS") return 3;
  if (ride.status === "MATCHED") return ride.pool?.status === "DRIVER_ARRIVED" ? 2 : 1;
  return 0;
}

export function RideProgress({ ride }: { ride: Ride }) {
  const current = stepFor(ride);
  return (
    <ol className="grid grid-cols-5 gap-1.5" aria-label="Ride progress">
      {STEPS.map((label, i) => (
        <li key={label} className="space-y-1.5">
          <div
            className={cx(
              "h-1.5 rounded-full",
              i < current ? "bg-brand" : i === current ? "animate-pulse bg-brand" : "bg-line",
            )}
          />
          <div className={cx("text-[11px] leading-tight", i === current ? "font-semibold text-ink" : "text-muted")}>
            {label}
          </div>
        </li>
      ))}
    </ol>
  );
}
