import type { PoolDetailRow, PoolPassengerRow } from '../models/pool.model';
import type { RideDetailRow } from '../models/rideRequest.model';

/** The DRIVER's view of a trip: who is on board, where they're going, what to collect. */
export function driverPoolView(p: PoolDetailRow, passengers: PoolPassengerRow[]) {
  const onBoard = passengers.filter((x) => x.status !== 'CANCELLED');
  return {
    id: p.id,
    status: p.status,
    pickup: { id: p.pickup_zone_id, name: p.pickup_zone_name },
    vehicle: { id: p.vehicle_id, name: p.vehicle_name, plate: p.vehicle_plate },
    capacity: p.capacity,
    seatsTaken: p.seats_taken,
    seatsFree: p.capacity - p.seats_taken,
    passengers: passengers.map((x) => ({
      rideId: x.ride_id,
      name: x.passenger_name,
      phone: x.passenger_phone,
      dropoff: { id: x.dropoff_zone_id, name: x.dropoff_zone_name },
      seats: x.seats,
      status: x.status,
      paymentMethod: x.payment_method,
      distanceM: x.distance_m,
      fare: {
        estimatedPaisa: x.estimated_fare_paisa,
        poolDiscountPaisa: x.pool_discount_paisa,
        finalPaisa: x.final_fare_paisa,
      },
    })),
    totalFarePaisa: p.status === 'COMPLETED' ? onBoard.reduce((sum, x) => sum + (x.final_fare_paisa ?? 0), 0) : null,
    createdAt: p.created_at,
    arrivedAt: p.arrived_at,
    startedAt: p.started_at,
    completedAt: p.completed_at,
    cancelledAt: p.cancelled_at,
  };
}

/** A waiting request in the driver's feed. */
export function driverRequestView(r: RideDetailRow) {
  return {
    id: r.id,
    passengerName: r.passenger_name,
    pickup: { id: r.pickup_zone_id, name: r.pickup_zone_name },
    dropoff: { id: r.dropoff_zone_id, name: r.dropoff_zone_name },
    seats: r.seats,
    distanceM: r.distance_m,
    estimatedFarePaisa: r.estimated_fare_paisa,
    requestedAt: r.created_at,
  };
}
