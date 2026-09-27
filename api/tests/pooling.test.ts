import { beforeEach, describe, expect, it } from 'vitest';
import { app, loginAs, pool, request, resetDb } from './support/helpers';
import { TRIPS, ZONE } from './support/zones';

type Agent = Awaited<ReturnType<typeof loginAs>>;

/** Extra Banani commuters for the stress test, beyond the main cast. */
async function signUpPassenger(name: string, phone: string) {
  const agent = request.agent(app);
  await agent.post('/api/auth/signup').send({ name, phone, password: 'rickshaw99' }).expect(201);
  return agent;
}

async function jashimOpensTripFor(jashim: Agent, rideId: string) {
  const res = await jashim.post(`/api/driver/requests/${rideId}/accept`).expect(200);
  return res.body.pool.id as string;
}

async function bulletSeats() {
  const { rows } = await pool.query(
    `SELECT p.seats_taken, p.capacity FROM pools p JOIN vehicles v ON v.id = p.vehicle_id
      WHERE v.name = 'Bullet' AND p.status IN ('OPEN', 'DRIVER_ARRIVED', 'STARTED')`,
  );
  return rows[0] as { seats_taken: number; capacity: number };
}

describe('pooling: Nusrat and Rafiq share Bullet', () => {
  beforeEach(resetDb);

  it('runs the Banani rush-hour story end to end with individual fares', async () => {
    const [jashim, nusrat, rafiq, shirin] = await Promise.all([
      loginAs('jashim'),
      loginAs('nusrat'),
      loginAs('rafiq'),
      loginAs('shirin'),
    ]);

    // 8:41 Nusrat books Banani -> Mohakhali. No Tesla yet, so she waits.
    const n = await nusrat.post('/api/rides').send(TRIPS.nusrat).expect(201);
    expect(n.body).toMatchObject({ matchOutcome: 'WAITING_FOR_DRIVER', ride: { status: 'REQUESTED' } });

    // Jashim accepts her: Bullet now has an open trip from Banani.
    const poolId = await jashimOpensTripFor(jashim, n.body.ride.id);

    // Two minutes later Rafiq books Banani -> Gulshan 1 and is matched automatically.
    const r = await rafiq.post('/api/rides').send(TRIPS.rafiq).expect(201);
    expect(r.body.matchOutcome).toBe('JOINED_POOL');
    expect(r.body.ride).toMatchObject({
      status: 'MATCHED',
      pool: { id: poolId, seatsTaken: 2, capacity: 3, coRiders: [{ name: 'Nusrat', dropoff: 'Mohakhali', seats: 1 }] },
    });

    // Shirin wants Banani -> Uttara: incompatible route, so she waits for another Tesla,
    // and Jashim isn't even offered her ride.
    const s = await shirin.post('/api/rides').send({ ...TRIPS.shirin, dropoffZoneId: ZONE.UTTARA }).expect(201);
    expect(s.body).toMatchObject({ matchOutcome: 'WAITING_FOR_DRIVER', ride: { status: 'REQUESTED', pool: null } });
    expect((await jashim.get('/api/driver/requests')).body.requests).toEqual([]);

    // Jashim sees exactly who is riding.
    const trip = (await jashim.get('/api/driver/pools/current')).body.pool;
    expect(trip.passengers.map((p: { name: string }) => p.name)).toEqual(['Nusrat', 'Rafiq']);

    for (const step of ['arrive', 'start', 'complete']) {
      await jashim.post(`/api/driver/pools/${poolId}/${step}`).expect(200);
    }

    // Individual pooled fares, as in the README worked example.
    const nusratRide = (await nusrat.get(`/api/rides/${n.body.ride.id}`)).body.ride;
    const rafiqRide = (await rafiq.get(`/api/rides/${r.body.ride.id}`)).body.ride;
    expect(nusratRide.fare).toEqual({ estimatedPaisa: 6450, poolDiscountPaisa: 1290, finalPaisa: 5160 });
    expect(rafiqRide.fare).toEqual({ estimatedPaisa: 6750, poolDiscountPaisa: 1350, finalPaisa: 5400 });

    // Nusrat sees that she shared with Rafiq, but never his fare.
    const nusratView = JSON.stringify(nusratRide);
    expect(nusratView).toContain('Rafiq');
    expect(nusratView).not.toContain('6750');
    expect(nusratView).not.toContain('5400');

    // Jashim collects ৳51.60 + ৳54.00.
    const done = (await jashim.get(`/api/driver/pools/${poolId}`)).body.pool;
    expect(done.totalFarePaisa).toBe(5160 + 5400);
  });

  it('does not discount a solo trip even if someone joined and then left', async () => {
    const [jashim, nusrat, rafiq] = await Promise.all([loginAs('jashim'), loginAs('nusrat'), loginAs('rafiq')]);
    const n = await nusrat.post('/api/rides').send(TRIPS.nusrat).expect(201);
    const poolId = await jashimOpensTripFor(jashim, n.body.ride.id);
    const r = await rafiq.post('/api/rides').send(TRIPS.rafiq).expect(201);
    await rafiq.post(`/api/rides/${r.body.ride.id}/cancel`).expect(200);

    for (const step of ['arrive', 'start', 'complete']) await jashim.post(`/api/driver/pools/${poolId}/${step}`).expect(200);
    const ride = (await nusrat.get(`/api/rides/${n.body.ride.id}`)).body.ride;
    expect(ride.fare.finalPaisa).toBe(6450);
  });

  it('lets Jashim add a compatible waiting ride to his open trip, but not an incompatible one', async () => {
    const [jashim, nusrat, rafiq, shirin] = await Promise.all([
      loginAs('jashim'),
      loginAs('nusrat'),
      loginAs('rafiq'),
      loginAs('shirin'),
    ]);
    // Both book before any Tesla exists, so both are waiting.
    const n = await nusrat.post('/api/rides').send(TRIPS.nusrat).expect(201);
    const r = await rafiq.post('/api/rides').send(TRIPS.rafiq).expect(201);
    const s = await shirin.post('/api/rides').send({ ...TRIPS.shirin, dropoffZoneId: ZONE.UTTARA }).expect(201);

    await jashimOpensTripFor(jashim, n.body.ride.id);
    const feed = (await jashim.get('/api/driver/requests')).body.requests;
    expect(feed.map((x: { passengerName: string }) => x.passengerName)).toEqual(['Rafiq']);

    await jashim.post(`/api/driver/requests/${r.body.ride.id}/accept`).expect(200);
    const refused = await jashim.post(`/api/driver/requests/${s.body.ride.id}/accept`).expect(409);
    expect(refused.body.error.code).toBe('ROUTE_INCOMPATIBLE');
  });

  it('closes the doors once the trip has started', async () => {
    const [jashim, nusrat, rafiq] = await Promise.all([loginAs('jashim'), loginAs('nusrat'), loginAs('rafiq')]);
    const n = await nusrat.post('/api/rides').send(TRIPS.nusrat).expect(201);
    const poolId = await jashimOpensTripFor(jashim, n.body.ride.id);
    await jashim.post(`/api/driver/pools/${poolId}/arrive`).expect(200);
    await jashim.post(`/api/driver/pools/${poolId}/start`).expect(200);

    const r = await rafiq.post('/api/rides').send(TRIPS.rafiq).expect(201);
    expect(r.body).toMatchObject({ matchOutcome: 'WAITING_FOR_DRIVER', ride: { status: 'REQUESTED' } });
  });
});

describe("capacity: Bullet's 3 seats are never exceeded", () => {
  beforeEach(resetDb);

  it('refuses a 2-seat booking when only 1 seat is left', async () => {
    const [jashim, nusrat, rafiq] = await Promise.all([loginAs('jashim'), loginAs('nusrat'), loginAs('rafiq')]);
    const n = await nusrat.post('/api/rides').send({ ...TRIPS.nusrat, seats: 2 }).expect(201);
    await jashimOpensTripFor(jashim, n.body.ride.id);

    const r = await rafiq.post('/api/rides').send({ ...TRIPS.rafiq, seats: 2 }).expect(201);
    expect(r.body.matchOutcome).toBe('WAITING_FOR_DRIVER');
    expect(await bulletSeats()).toEqual({ seats_taken: 2, capacity: 3 });

    // Jashim can't squeeze him in manually either.
    const res = await jashim.post(`/api/driver/requests/${r.body.ride.id}/accept`).expect(409);
    expect(res.body.error.code).toBe('SEAT_UNAVAILABLE');
  });

  it('is enforced by the database even if application code were bypassed', async () => {
    const [jashim, nusrat] = await Promise.all([loginAs('jashim'), loginAs('nusrat')]);
    const n = await nusrat.post('/api/rides').send(TRIPS.nusrat).expect(201);
    const poolId = await jashimOpensTripFor(jashim, n.body.ride.id);

    await expect(pool.query('UPDATE pools SET seats_taken = 4 WHERE id = $1', [poolId])).rejects.toMatchObject({
      constraint: 'pools_seats_within_capacity',
    });
  });
});

describe('concurrency: the last seat', () => {
  beforeEach(resetDb);

  it('Nusrat and Shirin race for Bullet\'s last seat: exactly one wins, nobody is overbooked', async () => {
    const [jashim, rafiq, nusrat, shirin] = await Promise.all([
      loginAs('jashim'),
      loginAs('rafiq'),
      loginAs('nusrat'),
      loginAs('shirin'),
    ]);
    // Rafiq and a colleague take 2 of Bullet's 3 seats.
    const r = await rafiq.post('/api/rides').send({ ...TRIPS.rafiq, seats: 2 }).expect(201);
    await jashimOpensTripFor(jashim, r.body.ride.id);
    expect(await bulletSeats()).toEqual({ seats_taken: 2, capacity: 3 });

    // Both see 1 seat left and book at the same instant.
    const [a, b] = await Promise.all([
      nusrat.post('/api/rides').send(TRIPS.nusrat),
      shirin.post('/api/rides').send(TRIPS.shirin),
    ]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);

    const outcomes = [a.body.matchOutcome, b.body.matchOutcome].sort();
    expect(outcomes[0]).toBe('JOINED_POOL');
    // The loser either saw a full Tesla already or lost the lock race; she is not an error, just waiting.
    expect(['LAST_SEAT_TAKEN', 'WAITING_FOR_DRIVER']).toContain(outcomes[1]);
    expect([a.body.ride.status, b.body.ride.status].sort()).toEqual(['MATCHED', 'REQUESTED']);
    expect(await bulletSeats()).toEqual({ seats_taken: 3, capacity: 3 });
  });

  it('survives a stampede: 6 Banani commuters, 2 free seats, 2 winners', async () => {
    const [jashim, nusrat] = await Promise.all([loginAs('jashim'), loginAs('nusrat')]);
    const n = await nusrat.post('/api/rides').send(TRIPS.nusrat).expect(201);
    const poolId = await jashimOpensTripFor(jashim, n.body.ride.id);

    const names = ['Tania', 'Babu', 'Mitu', 'Sumon', 'Lima', 'Rana'];
    const riders = await Promise.all(names.map((name, i) => signUpPassenger(name, `0191100001${i}`)));
    const results = await Promise.all(riders.map((agent) => agent.post('/api/rides').send(TRIPS.rafiq)));

    expect(results.every((res) => res.status === 201)).toBe(true);
    expect(results.filter((res) => res.body.matchOutcome === 'JOINED_POOL')).toHaveLength(2);
    expect(await bulletSeats()).toEqual({ seats_taken: 3, capacity: 3 });

    // The counter and the actual members agree.
    const { rows } = await pool.query(
      "SELECT COALESCE(sum(seats), 0)::int AS seats FROM ride_requests WHERE pool_id = $1 AND status = 'MATCHED'",
      [poolId],
    );
    expect(rows[0].seats).toBe(3);
  });

  it('two drivers accepting the same ride at once: one gets it, the other gets a clean 409', async () => {
    const [jashim, kamal, nusrat] = await Promise.all([loginAs('jashim'), loginAs('kamal'), loginAs('nusrat')]);
    await kamal.patch('/api/driver/availability').send({ online: true, zoneId: ZONE.BANANI }).expect(200);
    const n = await nusrat.post('/api/rides').send(TRIPS.nusrat).expect(201);

    const [a, b] = await Promise.all([
      jashim.post(`/api/driver/requests/${n.body.ride.id}/accept`),
      kamal.post(`/api/driver/requests/${n.body.ride.id}/accept`),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM pools WHERE status = 'OPEN'");
    expect(rows[0].n).toBe(1); // the loser's half-created pool was rolled back
  });

  it('a cancel racing with the trip start never leaves the ride half-cancelled', async () => {
    const [jashim, nusrat, rafiq] = await Promise.all([loginAs('jashim'), loginAs('nusrat'), loginAs('rafiq')]);
    const n = await nusrat.post('/api/rides').send(TRIPS.nusrat).expect(201);
    const poolId = await jashimOpensTripFor(jashim, n.body.ride.id);
    const r = await rafiq.post('/api/rides').send(TRIPS.rafiq).expect(201);
    await jashim.post(`/api/driver/pools/${poolId}/arrive`).expect(200);

    const [cancel, start] = await Promise.all([
      rafiq.post(`/api/rides/${r.body.ride.id}/cancel`),
      jashim.post(`/api/driver/pools/${poolId}/start`),
    ]);
    expect(start.status).toBe(200);
    const rafiqRide = (await rafiq.get(`/api/rides/${r.body.ride.id}`)).body.ride;
    if (cancel.status === 200) {
      expect(rafiqRide.status).toBe('CANCELLED');
      expect(await bulletSeats()).toMatchObject({ seats_taken: 1 });
    } else {
      expect(cancel.status).toBe(409);
      expect(rafiqRide.status).toBe('IN_PROGRESS');
      expect(await bulletSeats()).toMatchObject({ seats_taken: 2 });
    }
  });
});
