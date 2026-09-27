import { beforeEach, describe, expect, it } from 'vitest';
import { app, CAST, loginAs, request, resetDb, TEST_PASSWORD } from './support/helpers';

describe('auth', () => {
  beforeEach(resetDb);

  it('lets Nusrat sign in and see her own profile, without the password hash', async () => {
    const nusrat = await loginAs('nusrat');
    const res = await nusrat.get('/api/auth/me').expect(200);
    expect(res.body.user).toMatchObject({ name: 'Nusrat', role: 'PASSENGER', walletBalancePaisa: 50_000 });
    expect(JSON.stringify(res.body)).not.toContain('password');
    expect(res.body.vehicle).toBeNull();
  });

  it('shows Jashim his Tesla, Bullet, with 3 seats', async () => {
    const jashim = await loginAs('jashim');
    const res = await jashim.get('/api/auth/me').expect(200);
    expect(res.body.user.role).toBe('DRIVER');
    expect(res.body.vehicle).toMatchObject({ name: 'Bullet', capacity: 3 });
  });

  it('sets an httpOnly session cookie on login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: CAST.rafiq.phone, password: TEST_PASSWORD })
      .expect(200);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain('dtp_session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('gives the same error for an unknown phone and a wrong password', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ phone: CAST.rafiq.phone, password: 'not-his-password' })
      .expect(401);
    const unknownPhone = await request(app)
      .post('/api/auth/login')
      .send({ phone: '01999999999', password: 'whatever1' })
      .expect(401);
    expect(wrongPassword.body.error).toEqual(unknownPhone.body.error);
  });

  it('signs up a new passenger and logs them in', async () => {
    const agent = request.agent(app);
    const res = await agent
      .post('/api/auth/signup')
      .send({ name: 'Tania', phone: '01911000009', password: 'rickshaw99' })
      .expect(201);
    expect(res.body.user).toMatchObject({ name: 'Tania', role: 'PASSENGER' });
    await agent.get('/api/auth/me').expect(200);
  });

  it('refuses a duplicate phone number with 409', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Fake Nusrat', phone: CAST.nusrat.phone, password: 'password123' })
      .expect(409);
    expect(res.body.error.code).toBe('PHONE_TAKEN');
  });

  it('validates sign-up input', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: '', phone: '12345', password: 'short' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(res.body.error.details)).toEqual(expect.arrayContaining(['name', 'phone', 'password']));
  });

  it('rejects requests without a session, or with a forged token', async () => {
    await request(app).get('/api/auth/me').expect(401);
    await request(app).get('/api/auth/me').set('Authorization', 'Bearer not.a.jwt').expect(401);
  });

  it('logs out by clearing the cookie', async () => {
    const nusrat = await loginAs('nusrat');
    await nusrat.post('/api/auth/logout').expect(204);
    await nusrat.get('/api/auth/me').expect(401);
  });
});
