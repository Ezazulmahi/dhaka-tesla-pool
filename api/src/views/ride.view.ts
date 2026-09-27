import type { CoRiderRow, RideDetailRow } from '../models/rideRequest.model';
import type { RideEventRow } from '../models/rideEvent.model';

/**
 * What a PASSENGER sees about their own ride. Co-riders are shown by first name
 * and stop only: never their fare, phone or payment method.
 */
export function passengerRideView(r: RideDetailRow, coRiders: CoRiderRow[] = []) {
  return {
    id: r.id,
    status: r.status,
    pickup: { id: r.pickup_zone_id, name: r.pickup_zone_name },
    dropoff: { id: r.dropoff_zone_id, name: r.dropoff_zone_name },
    seats: r.seats,
    paymentMethod: r.payment_method,
    distanceM: r.distance_m,
    fare: {
      estimatedPaisa: r.estimated_fare_paisa,
      poolDiscountPaisa: r.pool_discount_paisa,
      finalPaisa: r.final_fare_paisa,
    },
    pool: r.pool_id
      ? {
          id: r.pool_id,
          status: r.pool_status,
          seatsTaken: r.pool_seats_taken,
          capacity: r.pool_capacity,
          driver: { name: r.driver_name, phone: r.driver_phone },
          vehicle: { name: r.vehicle_name, plate: r.vehicle_plate },
          coRiders: coRiders.map((c) => ({ name: c.passenger_name, dropoff: c.dropoff_zone_name, seats: c.seats })),
        }
      : null,
    cancelReason: r.cancel_reason,
    createdAt: r.created_at,
    matchedAt: r.matched_at,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    cancelledAt: r.cancelled_at,
  };
}

export function rideEventView(e: RideEventRow) {
  return {
    id: e.id,
    type: e.event_type,
    from: e.from_status,
    to: e.to_status,
    actor: e.actor_name,
    details: e.details,
    at: e.created_at,
  };
}
