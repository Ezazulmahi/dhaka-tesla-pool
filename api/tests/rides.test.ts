import { beforeEach, describe, expect, it } from 'vitest';
import { app, loginAs, pool, request, resetDb } from './support/helpers';
import { TRIPS, ZONE } from './support/zones';

describe('passenger ride requests', () => {
  beforeEach(resetDb);

  it('lists the Dhaka zones publicly', async () => {
    const res = await request(app).get('/api/zones').expect(200);
    expect(res.body.zones.map((z: { name: string }) => z.name)).toEqual(
      expect.arrayContaining(['Banani', 'Gulshan 1', 'Mohakhali', 'Uttara']),
    );
  });

  it('estimates Nusrat\'s Banani -> Mohakhali fare: ৳64.50 solo, ৳51.60 if shared', async () => {
    const nusrat = await loginAs('nusrat');
    const res = await nusrat
      .post('/api/rides/estimate')
      .send({ pickupZoneId: ZONE.BANANI, dropoffZoneId: ZONE.MOHAKHALI, seats: 1 })
      .expect(200);
    expect(res.body.estimate).toMatchObject({ distanceM: 2300, soloFarePaisa: 6450, pooledFarePaisa: 5160 });
  });

  it('creates a REQUESTED ride with the solo price as the estimate', async () => {
    const nusrat = await loginAs('nusrat');
    const res = await nusrat.post('/api/rides').send(TRIPS.nusrat).expect(201);
    expect(res.body.ride).toMatchObject({
      status: 'REQUESTED',
      pickup: { name: 'Banani' },
      dropoff: { name: 'Mohakhali' },
      fare: { estimatedPaisa: 6450, finalPaisa: null },
      pool: null,
    });
    const current = await nusrat.get('/api/rides/current').expect(200);
    expect(current.body.ride.id).toBe(res.body.ride.id);
  });

  it('allows only one active ride per passenger (double-tap safe)', async () => {
    const nusrat = await loginAs('nusrat');
    await nusrat.post('/api/rides').send(TRIPS.nusrat).expect(201);
    const second = await nusrat.post('/api/rides').send(TRIPS.nusrat).expect(409);
    expect(second.body.error.code).toBe('ACTIVE_RIDE_EXISTS');
  });

  it('holds the one-active-ride rule even for simultaneous double-taps', async () => {
    const nusrat = await loginAs('nusrat');
    const results = await Promise.all([1, 2, 3].map(() => nusrat.post('/api/rides').send(TRIPS.nusrat)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM ride_requests WHERE status = 'REQUESTED'");
    expect(rows[0].n).toBe(1);
  });

  it('rejects TeslaPay when Rafiq\'s wallet is empty', async () => {
    const rafiq = await loginAs('rafiq');
    const res = await rafiq.post('/api/rides').send({ ...TRIPS.rafiq, paymentMethod: 'TESLAPAY' }).expect(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');
  });

  it('validates the request body', async () => {
    const nusrat = await loginAs('nusrat');
    const same = await nusrat
      .post('/api/rides')
      .send({ pickupZoneId: ZONE.BANANI, dropoffZoneId: ZONE.BANANI, seats: 1 })
      .expect(400);
    expect(same.body.error.details.dropoffZoneId).toBeDefined();
    await nusrat.post('/api/rides').send({ ...TRIPS.nusrat, seats: 4 }).expect(400); // Bullet has 3 seats
    await nusrat.post('/api/rides').send({ ...TRIPS.nusrat, dropoffZoneId: 999 }).expect(400);
  });

  describe('ownership', () => {
    it("Rafiq can't see, read the history of, or cancel Nusrat's ride (404, not 403)", async () => {
      const nusrat = await loginAs('nusrat');
      const rafiq = await loginAs('rafiq');
      const { body } = await nusrat.post('/api/rides').send(TRIPS.nusrat).expect(201);

      await rafiq.get(`/api/rides/${body.ride.id}`).expect(404);
      await rafiq.get(`/api/rides/${body.ride.id}/events`).expect(404);
      await rafiq.post(`/api/rides/${body.ride.id}/cancel`).expect(404);

      const still = await nusrat.get(`/api/rides/${body.ride.id}`).expect(200);
      expect(still.body.ride.status).toBe('REQUESTED');
    });

    it('drivers cannot use passenger endpoints', async () => {
      const jashim = await loginAs('jashim');
      const res = await jashim.post('/api/rides').send(TRIPS.nusrat).expect(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('cancellation', () => {
    it('lets Nusrat cancel while waiting, records why, and frees her to book again', async () => {
      const nusrat = await loginAs('nusrat');
      const { body } = await nusrat.post('/api/rides').send(TRIPS.nusrat).expect(201);

      const res = await nusrat.post(`/api/rides/${body.ride.id}/cancel`).send({ reason: 'Found a rickshaw' }).expect(200);
      expect(res.body.ride).toMatchObject({ status: 'CANCELLED', cancelReason: 'Found a rickshaw' });

      const events = await nusrat.get(`/api/rides/${body.ride.id}/events`).expect(200);
      expect(events.body.events.map((e: { type: string }) => e.type)).toEqual(['RIDE_REQUESTED', 'RIDE_CANCELLED']);

      await nusrat.post('/api/rides').send(TRIPS.nusrat).expect(201);
    });

    it('rejects cancelling twice', async () => {
      const nusrat = await loginAs('nusrat');
      const { body } = await nusrat.post('/api/rides').send(TRIPS.nusrat).expect(201);
      await nusrat.post(`/api/rides/${body.ride.id}/cancel`).expect(200);
      const again = await nusrat.post(`/api/rides/${body.ride.id}/cancel`).expect(409);
      expect(again.body.error.code).toBe('INVALID_TRANSITION');
    });

    it('shows cancelled and past rides in history, newest first', async () => {
      const nusrat = await loginAs('nusrat');
      const first = await nusrat.post('/api/rides').send(TRIPS.nusrat).expect(201);
      await nusrat.post(`/api/rides/${first.body.ride.id}/cancel`).expect(200);
      const second = await nusrat.post('/api/rides').send({ ...TRIPS.nusrat, dropoffZoneId: ZONE.GULSHAN_1 }).expect(201);

      const res = await nusrat.get('/api/rides').expect(200);
      expect(res.body.rides.map((r: { id: string }) => r.id)).toEqual([second.body.ride.id, first.body.ride.id]);
    });
  });
});
