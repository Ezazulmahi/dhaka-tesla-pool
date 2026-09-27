import { type Db, queryOne } from '../db/pool';

export type UserRole = 'PASSENGER' | 'DRIVER';

export interface UserRow {
  id: string;
  name: string;
  phone: string;
  password_hash: string;
  role: UserRole;
  wallet_balance_paisa: number;
  created_at: Date;
}

export const userModel = {
  findById(db: Db, id: string) {
    return queryOne<UserRow>(db, 'SELECT * FROM users WHERE id = $1', [id]);
  },

  findByPhone(db: Db, phone: string) {
    return queryOne<UserRow>(db, 'SELECT * FROM users WHERE phone = $1', [phone]);
  },

  create(db: Db, u: { name: string; phone: string; passwordHash: string; role: UserRole }) {
    return queryOne<UserRow>(
      db,
      `INSERT INTO users (name, phone, password_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [u.name, u.phone, u.passwordHash, u.role],
    ) as Promise<UserRow>;
  },

  /** Conditional debit: returns null (and changes nothing) if the balance is too low. */
  debitWalletIfSufficient(db: Db, id: string, amountPaisa: number) {
    return queryOne<UserRow>(
      db,
      `UPDATE users SET wallet_balance_paisa = wallet_balance_paisa - $2
        WHERE id = $1 AND wallet_balance_paisa >= $2 RETURNING *`,
      [id, amountPaisa],
    );
  },
};
