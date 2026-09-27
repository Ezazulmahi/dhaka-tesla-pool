-- Dhaka Tesla Pool: core schema.
-- Integrity rules live here, not only in application code, so a bug or a
-- manual SQL fix can never overbook Bullet or give Nusrat two active rides.

CREATE TYPE user_role      AS ENUM ('PASSENGER', 'DRIVER');
CREATE TYPE pool_status    AS ENUM ('OPEN', 'DRIVER_ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED');
CREATE TYPE ride_status    AS ENUM ('REQUESTED', 'MATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE payment_method AS ENUM ('CASH', 'TESLAPAY');

-- Users --------------------------------------------------------------------
CREATE TABLE users (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  -- Bangladeshi mobile number, e.g. 01711000001. Used as the login handle.
  phone                 text NOT NULL UNIQUE CHECK (phone ~ '^01[3-9][0-9]{8}$'),
  password_hash         text NOT NULL,
  role                  user_role NOT NULL,
  -- Simulated TeslaPay wallet, in paisa. Can never go negative.
  wallet_balance_paisa  integer NOT NULL DEFAULT 0 CHECK (wallet_balance_paisa >= 0),
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Geography ----------------------------------------------------------------
CREATE TABLE zones (
  id    smallint PRIMARY KEY,
  code  text NOT NULL UNIQUE,
  name  text NOT NULL,
  lat   numeric(9, 6) NOT NULL,
  lng   numeric(9, 6) NOT NULL
);

CREATE TABLE zone_distances (
  from_zone_id  smallint NOT NULL REFERENCES zones (id),
  to_zone_id    smallint NOT NULL REFERENCES zones (id),
  distance_m    integer  NOT NULL CHECK (distance_m > 0),
  PRIMARY KEY (from_zone_id, to_zone_id),
  CHECK (from_zone_id <> to_zone_id)
);

-- Vehicles ("Teslas") ------------------------------------------------------
CREATE TABLE vehicles (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id        uuid NOT NULL UNIQUE REFERENCES users (id) ON DELETE RESTRICT,
  name             text NOT NULL,
  plate            text NOT NULL UNIQUE,
  capacity         smallint NOT NULL CHECK (capacity BETWEEN 1 AND 6),
  is_online        boolean NOT NULL DEFAULT false,
  current_zone_id  smallint REFERENCES zones (id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  -- An online Tesla must be somewhere.
  CONSTRAINT vehicles_online_needs_zone CHECK (NOT is_online OR current_zone_id IS NOT NULL)
);

CREATE INDEX vehicles_online_zone_idx ON vehicles (current_zone_id) WHERE is_online;

-- Pools (one Tesla trip, shared by one or more ride requests) --------------
CREATE TABLE pools (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      uuid NOT NULL REFERENCES vehicles (id),
  driver_id       uuid NOT NULL REFERENCES users (id),
  pickup_zone_id  smallint NOT NULL REFERENCES zones (id),
  status          pool_status NOT NULL DEFAULT 'OPEN',
  -- Snapshot of the vehicle capacity when the pool was created.
  capacity        smallint NOT NULL CHECK (capacity BETWEEN 1 AND 6),
  seats_taken     smallint NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  arrived_at      timestamptz,
  started_at      timestamptz,
  completed_at    timestamptz,
  cancelled_at    timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- Last line of defence: Bullet never carries more than it has seats.
  CONSTRAINT pools_seats_within_capacity CHECK (seats_taken >= 0 AND seats_taken <= capacity)
);

-- A Tesla can only run one live trip at a time.
CREATE UNIQUE INDEX pools_one_active_per_vehicle
  ON pools (vehicle_id) WHERE status IN ('OPEN', 'DRIVER_ARRIVED', 'STARTED');
-- Matching: "joinable pools in Banani, oldest first".
CREATE INDEX pools_joinable_idx
  ON pools (pickup_zone_id, created_at) WHERE status IN ('OPEN', 'DRIVER_ARRIVED');
CREATE INDEX pools_driver_history_idx ON pools (driver_id, created_at DESC);

-- Ride requests (one passenger's trip) --------------------------------------
CREATE TABLE ride_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id          uuid NOT NULL REFERENCES users (id),
  pool_id               uuid REFERENCES pools (id),
  pickup_zone_id        smallint NOT NULL REFERENCES zones (id),
  dropoff_zone_id       smallint NOT NULL REFERENCES zones (id),
  seats                 smallint NOT NULL CHECK (seats BETWEEN 1 AND 6),
  status                ride_status NOT NULL DEFAULT 'REQUESTED',
  payment_method        payment_method NOT NULL DEFAULT 'CASH',
  distance_m            integer NOT NULL CHECK (distance_m > 0),
  estimated_fare_paisa  integer NOT NULL CHECK (estimated_fare_paisa >= 0),
  pool_discount_paisa   integer CHECK (pool_discount_paisa >= 0),
  final_fare_paisa      integer CHECK (final_fare_paisa >= 0),
  cancel_reason         text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  matched_at            timestamptz,
  started_at            timestamptz,
  completed_at          timestamptz,
  cancelled_at          timestamptz,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ride_requests_distinct_zones CHECK (pickup_zone_id <> dropoff_zone_id),
  -- Waiting rides have no Tesla; matched/riding/finished rides always do.
  CONSTRAINT ride_requests_pool_membership CHECK (
    (status = 'REQUESTED' AND pool_id IS NULL)
    OR (status IN ('MATCHED', 'IN_PROGRESS', 'COMPLETED') AND pool_id IS NOT NULL)
    OR status = 'CANCELLED'
  ),
  -- A final fare exists exactly when the ride is completed.
  CONSTRAINT ride_requests_final_fare_on_completion CHECK ((status = 'COMPLETED') = (final_fare_paisa IS NOT NULL))
);

-- Nusrat can only have one live ride at a time (also stops double-submits).
CREATE UNIQUE INDEX ride_requests_one_active_per_passenger
  ON ride_requests (passenger_id) WHERE status IN ('REQUESTED', 'MATCHED', 'IN_PROGRESS');
-- Driver feed: "waiting rides in Banani, oldest first".
CREATE INDEX ride_requests_waiting_idx
  ON ride_requests (pickup_zone_id, created_at) WHERE status = 'REQUESTED';
CREATE INDEX ride_requests_pool_idx ON ride_requests (pool_id);
CREATE INDEX ride_requests_passenger_history_idx ON ride_requests (passenger_id, created_at DESC);

-- Audit trail ----------------------------------------------------------------
CREATE TABLE ride_events (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ride_request_id  uuid REFERENCES ride_requests (id),
  pool_id          uuid REFERENCES pools (id),
  actor_id         uuid REFERENCES users (id),
  event_type       text NOT NULL,
  from_status      text,
  to_status        text,
  details          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (ride_request_id IS NOT NULL OR pool_id IS NOT NULL)
);

CREATE INDEX ride_events_ride_idx ON ride_events (ride_request_id, created_at);
CREATE INDEX ride_events_pool_idx ON ride_events (pool_id, created_at);
