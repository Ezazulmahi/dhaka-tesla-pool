// Shapes returned by the API (see api/src/views). Kept by hand: the API is small
// and a shared package would add build plumbing we don't need yet.

export type Role = "PASSENGER" | "DRIVER";
export type RideStatus = "REQUESTED" | "MATCHED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type PoolStatus = "OPEN" | "DRIVER_ARRIVED" | "STARTED" | "COMPLETED" | "CANCELLED";
export type PaymentMethod = "CASH" | "TESLAPAY";
export type MatchOutcome = "JOINED_POOL" | "WAITING_FOR_DRIVER" | "LAST_SEAT_TAKEN";

export interface User {
  id: string;
  name: string;
  phone: string;
  role: Role;
  walletBalancePaisa: number;
}

export interface Vehicle {
  id: string;
  name: string;
  plate: string;
  capacity: number;
  isOnline: boolean;
  currentZoneId: number | null;
}

export interface Zone {
  id: number;
  code: string;
  name: string;
  lat: number;
  lng: number;
}

export interface Estimate {
  distanceM: number;
  seats: number;
  baseFarePaisa: number;
  distanceChargePaisa: number;
  subtotalPaisa: number;
  soloFarePaisa: number;
  pooledFarePaisa: number;
}

export interface Ride {
  id: string;
  status: RideStatus;
  pickup: { id: number; name: string };
  dropoff: { id: number; name: string };
  seats: number;
  paymentMethod: PaymentMethod;
  distanceM: number;
  fare: { estimatedPaisa: number; poolDiscountPaisa: number | null; finalPaisa: number | null };
  pool: {
    id: string;
    status: PoolStatus;
    seatsTaken: number;
    capacity: number;
    driver: { name: string; phone: string };
    vehicle: { name: string; plate: string };
    coRiders: { name: string; dropoff: string; seats: number }[];
  } | null;
  cancelReason: string | null;
  createdAt: string;
  matchedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface RideEvent {
  id: string;
  type: string;
  from: string | null;
  to: string | null;
  actor: string | null;
  details: Record<string, unknown>;
  at: string;
}

export interface PoolPassenger {
  rideId: string;
  name: string;
  phone: string;
  dropoff: { id: number; name: string };
  seats: number;
  status: RideStatus;
  paymentMethod: PaymentMethod;
  distanceM: number;
  fare: { estimatedPaisa: number; poolDiscountPaisa: number | null; finalPaisa: number | null };
}

export interface Pool {
  id: string;
  status: PoolStatus;
  pickup: { id: number; name: string };
  vehicle: { id: string; name: string; plate: string };
  capacity: number;
  seatsTaken: number;
  seatsFree: number;
  passengers: PoolPassenger[];
  totalFarePaisa: number | null;
  createdAt: string;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface WaitingRequest {
  id: string;
  passengerName: string;
  pickup: { id: number; name: string };
  dropoff: { id: number; name: string };
  seats: number;
  distanceM: number;
  estimatedFarePaisa: number;
  requestedAt: string;
}
