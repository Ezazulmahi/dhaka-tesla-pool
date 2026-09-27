import { pool, withTransaction } from './pool';
import { env } from '../config/env';
import { hashPassword } from '../lib/password';
import { logger } from '../lib/logger';

// The story cast. Every demo, test and screenshot uses these people.
export const CAST = {
  jashim: { name: 'Jashim', phone: '01711000001', role: 'DRIVER', wallet: 0 },
  kamal: { name: 'Kamal', phone: '01711000002', role: 'DRIVER', wallet: 0 },
  nusrat: { name: 'Nusrat', phone: '01811000001', role: 'PASSENGER', wallet: 50_000 }, // ৳500 TeslaPay
  rafiq: { name: 'Rafiq', phone: '01811000002', role: 'PASSENGER', wallet: 0 }, // pays cash
  shirin: { name: 'Shirin', phone: '01811000003', role: 'PASSENGER', wallet: 30_000 }, // ৳300 TeslaPay
} as const;

export const TESLAS = {
  bullet: { driver: 'jashim', name: 'Bullet', plate: 'Dhaka Metro-Ta 11-0311', capacity: 3, onlineIn: 'BANANI' },
  toofan: { driver: 'kamal', name: 'Toofan', plate: 'Dhaka Metro-Ta 11-0722', capacity: 3, onlineIn: null },
} as const;

/** Idempotent: safe to run on every container start. */
export async function seed(password = env.SEED_PASSWORD) {
  const passwordHash = await hashPassword(password);

  await withTransaction(async (tx) => {
    const ids: Record<string, string> = {};
    for (const [key, u] of Object.entries(CAST)) {
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO users (name, phone, password_hash, role, wallet_balance_paisa)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [u.name, u.phone, passwordHash, u.role, u.wallet],
      );
      ids[key] = rows[0]!.id;
    }

    for (const t of Object.values(TESLAS)) {
      await tx.query(
        `INSERT INTO vehicles (driver_id, name, plate, capacity, is_online, current_zone_id)
         VALUES ($1, $2, $3, $4, $5, (SELECT id FROM zones WHERE code = $6))
         ON CONFLICT (driver_id) DO NOTHING`,
        [ids[t.driver], t.name, t.plate, t.capacity, t.onlineIn !== null, t.onlineIn],
      );
    }
  });
}

if (require.main === module) {
  seed()
    .then(() => {
      logger.info('seed complete: Jashim & Bullet, Kamal & Toofan, Nusrat, Rafiq, Shirin');
      return pool.end();
    })
    .catch((err) => {
      logger.error({ err }, 'seed failed');
      process.exit(1);
    });
}
