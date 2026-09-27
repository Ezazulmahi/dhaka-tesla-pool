import { describe, expect, it } from 'vitest';
import {
  assertPoolTransition,
  assertRideTransition,
  POOL_TRANSITIONS,
  RIDE_TRANSITIONS,
  type PoolStatus,
  type RideStatus,
} from '../src/domain/stateMachine';

describe('ride request lifecycle', () => {
  it.each<[RideStatus, RideStatus]>([
    ['REQUESTED', 'MATCHED'],
    ['REQUESTED', 'CANCELLED'],
    ['MATCHED', 'IN_PROGRESS'],
    ['MATCHED', 'CANCELLED'],
    ['MATCHED', 'REQUESTED'],
    ['IN_PROGRESS', 'COMPLETED'],
  ])('allows %s -> %s', (from, to) => {
    expect(() => assertRideTransition(from, to)).not.toThrow();
  });

  it.each<[RideStatus, RideStatus]>([
    ['REQUESTED', 'IN_PROGRESS'], // can't ride without a Tesla
    ['REQUESTED', 'COMPLETED'],
    ['IN_PROGRESS', 'CANCELLED'], // already in the car
    ['COMPLETED', 'CANCELLED'],
    ['CANCELLED', 'REQUESTED'], // cancelled is final
    ['COMPLETED', 'IN_PROGRESS'],
  ])('rejects %s -> %s with INVALID_TRANSITION', (from, to) => {
    expect(() => assertRideTransition(from, to)).toThrow(expect.objectContaining({ code: 'INVALID_TRANSITION' }));
  });

  it('has terminal states with no way out', () => {
    expect(RIDE_TRANSITIONS.COMPLETED).toHaveLength(0);
    expect(RIDE_TRANSITIONS.CANCELLED).toHaveLength(0);
  });
});

describe('pool (Tesla trip) lifecycle', () => {
  it('follows OPEN -> DRIVER_ARRIVED -> STARTED -> COMPLETED', () => {
    const path: PoolStatus[] = ['OPEN', 'DRIVER_ARRIVED', 'STARTED', 'COMPLETED'];
    for (let i = 0; i < path.length - 1; i++) {
      expect(() => assertPoolTransition(path[i]!, path[i + 1]!)).not.toThrow();
    }
  });

  it.each<[PoolStatus, PoolStatus]>([
    ['OPEN', 'STARTED'], // Jashim must arrive before starting
    ['OPEN', 'COMPLETED'],
    ['STARTED', 'CANCELLED'], // passengers are on board
    ['COMPLETED', 'OPEN'],
  ])('rejects %s -> %s', (from, to) => {
    expect(() => assertPoolTransition(from, to)).toThrow(expect.objectContaining({ status: 409 }));
  });

  it('has terminal states with no way out', () => {
    expect(POOL_TRANSITIONS.COMPLETED).toHaveLength(0);
    expect(POOL_TRANSITIONS.CANCELLED).toHaveLength(0);
  });
});
