import { randomUUID } from 'crypto';
import type { Adapter, AdapterUser, AdapterAccount } from 'next-auth/adapters';
import pool from '@kaca/common/db';
import type { RowDataPacket } from 'mysql2';

interface UserRow extends RowDataPacket {
  id: string;
  name: string | null;
  email: string;
  email_verified: Date | null;
  password_hash: string | null;
  image: string | null;
  role: string;
}

function toAdapterUser(row: UserRow): AdapterUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: row.email_verified,
    image: row.image,
    role: row.role,
  };
}

export function MySQLAdapter(): Adapter {
  return {
    async createUser(user) {
      const id = randomUUID();
      await pool.execute(
        `INSERT INTO auth_user (id, name, email, email_verified, image)
         VALUES (?, ?, ?, ?, ?)`,
        [id, user.name ?? null, user.email, user.emailVerified ?? null, user.image ?? null]
      );
      return { ...user, id, role: 'teacher' };
    },

    async getUser(id) {
      const [rows] = await pool.execute<UserRow[]>(
        'SELECT * FROM auth_user WHERE id = ?',
        [id]
      );
      return rows[0] ? toAdapterUser(rows[0]) : null;
    },

    async getUserByEmail(email) {
      const [rows] = await pool.execute<UserRow[]>(
        'SELECT * FROM auth_user WHERE email = ?',
        [email]
      );
      return rows[0] ? toAdapterUser(rows[0]) : null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const [rows] = await pool.execute<UserRow[]>(
        `SELECT u.* FROM auth_user u
         JOIN auth_account a ON u.id = a.user_id
         WHERE a.provider = ? AND a.provider_account_id = ?`,
        [provider, providerAccountId]
      );
      return rows[0] ? toAdapterUser(rows[0]) : null;
    },

    async updateUser(user) {
      const fields: string[] = [];
      const values: unknown[] = [];
      if (user.name !== undefined) { fields.push('name = ?'); values.push(user.name); }
      if (user.email !== undefined) { fields.push('email = ?'); values.push(user.email); }
      if (user.emailVerified !== undefined) { fields.push('email_verified = ?'); values.push(user.emailVerified); }
      if (user.image !== undefined) { fields.push('image = ?'); values.push(user.image); }
      if (fields.length === 0) return user as AdapterUser;

      values.push(user.id);
      await pool.execute(
        `UPDATE auth_user SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
      const [rows] = await pool.execute<UserRow[]>(
        'SELECT * FROM auth_user WHERE id = ?',
        [user.id]
      );
      return toAdapterUser(rows[0]);
    },

    async linkAccount(account) {
      const id = randomUUID();
      await pool.execute(
        `INSERT INTO auth_account
         (id, user_id, type, provider, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          account.userId,
          account.type,
          account.provider,
          account.providerAccountId,
          account.refresh_token ?? null,
          account.access_token ?? null,
          account.expires_at ?? null,
          account.token_type ?? null,
          account.scope ?? null,
          account.id_token ?? null,
        ]
      );
      return account as AdapterAccount;
    },

    async unlinkAccount({ provider, providerAccountId }) {
      await pool.execute(
        'DELETE FROM auth_account WHERE provider = ? AND provider_account_id = ?',
        [provider, providerAccountId]
      );
    },
  };
}
