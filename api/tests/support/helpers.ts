import request from 'supertest';
import { createApp } from '../../src/app';
import { pool } from '../../src/db/pool';
import { CAST, seed } from '../../src/db/seed';

export const TEST_PASSWORD = 'bullet123';
export const app = createApp();
export type CastMember = keyof typeof CAST;

/** Wipe everything and re-seed the story cast. Zones are reference data and stay. */
export async function resetDb() {
  await pool.query('TRUNCATE ride_events, ride_requests, pools, vehicles, users RESTART IDENTITY CASCADE');
  await seed(TEST_PASSWORD);
}

/** A supertest agent that keeps the session cookie, i.e. a logged-in browser. */
export async function loginAs(who: CastMember) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ phone: CAST[who].phone, password: TEST_PASSWORD }).expect(200);
  return agent;
}

export { request, pool, CAST };
