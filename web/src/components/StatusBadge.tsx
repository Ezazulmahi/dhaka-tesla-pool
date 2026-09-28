import type { PoolStatus, RideStatus } from "@/lib/types";
import { POOL_STATUS_LABEL, RIDE_STATUS_LABEL } from "@/lib/format";
import { Badge, type BadgeTone } from "./ui";

const RIDE_TONE: Record<RideStatus, BadgeTone> = {
  REQUESTED: "live",
  MATCHED: "brand",
  IN_PROGRESS: "brand",
  COMPLETED: "done",
  CANCELLED: "bad",
};

const POOL_TONE: Record<PoolStatus, BadgeTone> = {
  OPEN: "live",
  DRIVER_ARRIVED: "brand",
  STARTED: "brand",
  COMPLETED: "done",
  CANCELLED: "bad",
};

export const RideStatusBadge = ({ status }: { status: RideStatus }) => (
  <Badge tone={RIDE_TONE[status]}>{RIDE_STATUS_LABEL[status]}</Badge>
);

export const PoolStatusBadge = ({ status }: { status: PoolStatus }) => (
  <Badge tone={POOL_TONE[status]}>{POOL_STATUS_LABEL[status]}</Badge>
);
