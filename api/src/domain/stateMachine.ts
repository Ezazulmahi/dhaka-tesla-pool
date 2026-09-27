import { AppError } from '../lib/errors';

// Two lifecycles (see docs/architecture.md §4): the passenger's ride request and
// the Tesla's pool. Every status change in the codebase goes through assertTransition.

export type RideStatus = 'REQUESTED' | 'MATCHED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type PoolStatus = 'OPEN' | 'DRIVER_ARRIVED' | 'STARTED' | 'COMPLETED' | 'CANCELLED';

export const RIDE_TRANSITIONS: Record<RideStatus, readonly RideStatus[]> = {
  REQUESTED: ['MATCHED', 'CANCELLED'],
  // MATCHED -> REQUESTED: the driver cancelled the pool, so the passenger goes back in the queue.
  MATCHED: ['IN_PROGRESS', 'CANCELLED', 'REQUESTED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const POOL_TRANSITIONS: Record<PoolStatus, readonly PoolStatus[]> = {
  OPEN: ['DRIVER_ARRIVED', 'CANCELLED'],
  DRIVER_ARRIVED: ['STARTED', 'CANCELLED'],
  STARTED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

/** Pools still accepting passengers: Jashim hasn't driven off yet. */
export const JOINABLE_POOL_STATUSES: readonly PoolStatus[] = ['OPEN', 'DRIVER_ARRIVED'];
export const ACTIVE_POOL_STATUSES: readonly PoolStatus[] = ['OPEN', 'DRIVER_ARRIVED', 'STARTED'];
export const ACTIVE_RIDE_STATUSES: readonly RideStatus[] = ['REQUESTED', 'MATCHED', 'IN_PROGRESS'];
/** A passenger may cancel until the Tesla starts moving. */
export const CANCELLABLE_RIDE_STATUSES: readonly RideStatus[] = ['REQUESTED', 'MATCHED'];

export function canTransition<S extends string>(table: Record<S, readonly S[]>, from: S, to: S): boolean {
  return table[from]?.includes(to) ?? false;
}

export function assertRideTransition(from: RideStatus, to: RideStatus) {
  if (!canTransition(RIDE_TRANSITIONS, from, to)) {
    throw new AppError(409, 'INVALID_TRANSITION', `A ride cannot go from ${from} to ${to}`, { from, to });
  }
}

export function assertPoolTransition(from: PoolStatus, to: PoolStatus) {
  if (!canTransition(POOL_TRANSITIONS, from, to)) {
    throw new AppError(409, 'INVALID_TRANSITION', `A trip cannot go from ${from} to ${to}`, { from, to });
  }
}
