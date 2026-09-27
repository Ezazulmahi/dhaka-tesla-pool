import { beforeEach, describe, expect, it } from 'vitest';
import { loginAs, pool, resetDb } from './support/helpers';
import { TRIPS, ZONE } from './support/zones';

type Agent = Awaited<ReturnType<typeof loginAs>>;

async function requestRide(agent: Agent, trip: object) {
  const res = await agent.post('/api/rides').send(trip).expect(201);
  return res.body.ride.id as string;
}

describe('driver flow: Jashim and Bullet', () => {
  beforeEach(resetDb);

  it("shows Jashim waiting rides in his zone (Banani) but not elsewhere", async () => {
    const [jashim, nusrat, shirin] = await Promise.all([loginAs('jashim'), loginAs('nusrat'), loginAs('shirin')]);
    await requestRide(nusrat, TRIPS.nusrat);
    await requestRide(shirin, { pickupZoneId: ZONE.DHANMONDI, dropoffZoneId: ZONE.FARMGATE, seats: 1 });

    const feed = await jashim.get('/api/driver/requests').expect(200);
    expect(feed.body.online).toBe(true);
    expect(feed.body.requests).toHaveLength(1);
    expect(feed.body.requests[0]).toMatchObject({ passengerName: 'Nusrat', dropoff: { name: 'Mohakhali' } });
  });

  it('shows nothing and refuses accepts while offline', async () => {
    const [jashim, nusrat] = await Promise.all([loginAs('jashim'), loginAs('nusrat')]);
    const rideId = await requestRide(nusrat, TRIPS.nusrat);
    await jashim.patch('/api/driver/availability').send({ online: false }).expect(200);

    const feed = await jashim.get('/api/driver/requests').expect(200);
    expect(feed.body).toEqual({ online: false, requests: [] });
    const res = await jashim.post(`/api/driver/requests/${rideId}/accept`).expect(409);
    expect(res.body.error.code).toBe('DRIVER_OFFLINE');
  });

  it('runs the full trip: accept -> arrive -> start -> complete, with a solo fare', async () => {
    const [jashim, nusrat] = await Promise.all([loginAs('jashim'), loginAs('nusrat')]);
    const rideId = await requestRide(nusrat, TRIPS.nusrat);

    const accepted = await jashim.post(`/api/driver/requests/${rideId}/accept`).expect(200);
    const poolId = accepted.body.pool.id;
    expect(accepted.body.pool).toMatchObject({ status: 'OPEN', capacity: 3, seatsTaken: 1, seatsFree: 2 });
    expect((await nusrat.get(`/api/rides/${rideId}`)).body.ride).toMatchObject({
      status: 'MATCHED',
      pool: { status: 'OPEN', driver: { name: 'Jashim' }, vehicle: { name: 'Bullet' } },
    });

    await jashim.post(`/api/driver/pools/${poolId}/arrive`).expect(200);
    expect((await nusrat.get('/api/rides/current')).body.ride.pool.status).toBe('DRIVER_ARRIVED');

    await jashim.post(`/api/driver/pools/${poolId}/start`).expect(200);
    expect((await nusrat.get('/api/rides/current')).body.ride.status).toBe('IN_PROGRESS');

    const done = await jashim.post(`/api/driver/pools/${poolId}/complete`).expect(200);
    expect(done.body.pool).toMatchObject({ status: 'COMPLETED', totalFarePaisa: 6450 });

    const ride = (await nusrat.get(`/api/rides/${rideId}`)).body.ride;
    expect(ride).toMatchObject({ status: 'COMPLETED', fare: { estimatedPaisa: 6450, poolDiscountPaisa: 0, finalPaisa: 6450 } });

    // Nusrat paid with TeslaPay: ৳500.00 - ৳64.50
    const me = await nusrat.get('/api/auth/me');
    expect(me.body.user.walletBalancePaisa).toBe(50_000 - 6450);

    const events = (await nusrat.get(`/api/rides/${rideId}/events`)).body.events.map((e: { type: string }) => e.type);
    expect(events).toEqual([
      'RIDE_REQUESTED',
      'POOL_CREATED',
      'RIDE_MATCHED',
      'POOL_DRIVER_ARRIVED',
      'POOL_STARTED',
      'RIDE_STARTED',
      'POOL_COMPLETED',
      'RIDE_COMPLETED',
      'PAYMENT_CAPTURED',
    ]);
  });

  describe('invalid transitions are rejected', () => {
    it("can't start before arriving, or complete before starting", async () => {
      const [jashim, nusrat] = await Promise.all([loginAs('jashim'), loginAs('nusrat')]);
      const rideId = await requestRide(nusrat, TRIPS.nusrat);
      const poolId = (await jashim.post(`/api/driver/requests/${rideId}/accept`)).body.pool.id;

      const early = await jashim.post(`/api/driver/pools/${poolId}/start`).expect(409);
      expect(early.body.error).toMatchObject({ code: 'INVALID_TRANSITION', details: { from: 'OPEN', to: 'STARTED' } });
      await jashim.post(`/api/driver/pools/${poolId}/complete`).expect(409);

      await jashim.post(`/api/driver/pools/${poolId}/arrive`).expect(200);
      await jashim.post(`/api/driver/pools/${poolId}/arrive`).expect(409); // twice
      await jashim.post(`/api/driver/pools/${poolId}/start`).expect(200);
      await jashim.post(`/api/driver/pools/${poolId}/cancel`).expect(409); // passengers on board
      await jashim.post(`/api/driver/pools/${poolId}/complete`).expect(200);
      await jashim.post(`/api/driver/pools/${poolId}/complete`).expect(409); // twice
    });

    it("won't let Nusrat cancel once Bullet has started moving", async () => {
      const [jashim, nusrat] = await Promise.all([loginAs('jashim'), loginAs('nusrat')]);
      const rideId = await requestRide(nusrat, TRIPS.nusrat);
      const poolId = (await jashim.post(`/api/driver/requests/${rideId}/accept`)).body.pool.id;
      await jashim.post(`/api/driver/pools/${poolId}/arrive`);
      await jashim.post(`/api/driver/pools/${poolId}/start`);

      const res = await nusrat.post(`/api/rides/${rideId}/cancel`).expect(409);
      expect(res.body.error.code).toBe('INVALID_TRANSITION');
    });

    it("can't accept a ride someone already took or cancelled", async () => {
      const [jashim, nusrat] = await Promise.all([loginAs('jashim'), loginAs('nusrat')]);
      const rideId = await requestRide(nusrat, TRIPS.nusrat);
      await nusrat.post(`/api/rides/${rideId}/cancel`).expect(200);
      const res = await jashim.post(`/api/driver/requests/${rideId}/accept`).expect(409);
      expect(res.body.error.code).toBe('RIDE_ALREADY_TAKEN');
    });
  });

  describe('cancellations', () => {
    it('frees the seat when a matched passenger cancels, and ends an empty trip', async () => {
      const [jashim, nusrat] = await Promise.all([loginAs('jashim'), loginAs('nusrat')]);
      const rideId = await requestRide(nusrat, TRIPS.nusrat);
      const poolId = (await jashim.post(`/api/driver/requests/${rideId}/accept`)).body.pool.id;

      await nusrat.post(`/api/rides/${rideId}/cancel`).send({ reason: 'Meeting moved' }).expect(200);
      const trip = (await jashim.get(`/api/driver/pools/${poolId}`)).body.pool;
      expect(trip).toMatchObject({ status: 'CANCELLED', seatsTaken: 0 });
      expect((await jashim.get('/api/driver/pools/current')).body.pool).toBeNull();
    });

    it('puts passengers back in the queue when Jashim cancels the trip', async () => {
      const [jashim, nusrat] = await Promise.all([loginAs('jashim'), loginAs('nusrat')]);
      const rideId = await requestRide(nusrat, TRIPS.nusrat);
      const poolId = (await jashim.post(`/api/driver/requests/${rideId}/accept`)).body.pool.id;

      await jashim.post(`/api/driver/pools/${poolId}/cancel`).send({ reason: 'Flat tyre' }).expect(200);
      const ride = (await nusrat.get(`/api/rides/${rideId}`)).body.ride;
      expect(ride).toMatchObject({ status: 'REQUESTED', pool: null });
      // ...and she's visible to drivers again
      expect((await jashim.get('/api/driver/requests')).body.requests).toHaveLength(1);
    });

    it("won't let Jashim go offline mid-trip", async () => {
      const [jashim, nusrat] = await Promise.all([loginAs('jashim'), loginAs('nusrat')]);
      const rideId = await requestRide(nusrat, TRIPS.nusrat);
      await jashim.post(`/api/driver/requests/${rideId}/accept`).expect(200);
      const res = await jashim.patch('/api/driver/availability').send({ online: false }).expect(409);
      expect(res.body.error.code).toBe('ACTIVE_TRIP');
    });
  });

  describe('authorisation', () => {
    it("Kamal can't drive Jashim's trip, and passengers can't use driver endpoints", async () => {
      const [jashim, kamal, nusrat] = await Promise.all([loginAs('jashim'), loginAs('kamal'), loginAs('nusrat')]);
      const rideId = await requestRide(nusrat, TRIPS.nusrat);
      const poolId = (await jashim.post(`/api/driver/requests/${rideId}/accept`)).body.pool.id;

      await kamal.post(`/api/driver/pools/${poolId}/arrive`).expect(404);
      await kamal.get(`/api/driver/pools/${poolId}`).expect(404);
      await nusrat.post(`/api/driver/pools/${poolId}/arrive`).expect(403);
      await nusrat.get('/api/driver/requests').expect(403);

      const { rows } = await pool.query('SELECT status FROM pools WHERE id = $1', [poolId]);
      expect(rows[0].status).toBe('OPEN');
    });

    it("Kamal can't accept a Banani ride from Dhanmondi", async () => {
      const [kamal, nusrat] = await Promise.all([loginAs('kamal'), loginAs('nusrat')]);
      await kamal.patch('/api/driver/availability').send({ online: true, zoneId: ZONE.DHANMONDI }).expect(200);
      const rideId = await requestRide(nusrat, TRIPS.nusrat);
      const res = await kamal.post(`/api/driver/requests/${rideId}/accept`).expect(409);
      expect(res.body.error.code).toBe('OUT_OF_ZONE');
    });
  });

  it('keeps a ride history for Jashim', async () => {
    const [jashim, nusrat] = await Promise.all([loginAs('jashim'), loginAs('nusrat')]);
    const rideId = await requestRide(nusrat, TRIPS.nusrat);
    const poolId = (await jashim.post(`/api/driver/requests/${rideId}/accept`)).body.pool.id;
    for (const step of ['arrive', 'start', 'complete']) await jashim.post(`/api/driver/pools/${poolId}/${step}`).expect(200);

    const history = (await jashim.get('/api/driver/pools').expect(200)).body.pools;
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ status: 'COMPLETED', passengers: [{ name: 'Nusrat', status: 'COMPLETED' }] });
  });
});
