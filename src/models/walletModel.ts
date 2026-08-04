import type { PoolClient } from "pg";
import { query } from "../database/db";

export interface Wallet {
  id: string;
  user_id: string;
  created_at: string | Date;
  updated_at: string | Date;
}

/**
 * Creates a new wallet for a user.
 * @param userId - User UUID
 * @param client - Optional database client for transaction support
 * @returns The newly created wallet object.
 */
export async function createWallet(userId: string, client?: PoolClient): Promise<Wallet> {
  const sql = `
    INSERT INTO wallets (user_id)
    VALUES ($1)
    RETURNING id, user_id, created_at, updated_at
  `;
  const result = client ? await client.query(sql, [userId]) : await query(sql, [userId]);
  if (result.rows.length === 0) {
    throw new Error("No se pudo crear la billetera en la base de datos.");
  }
  return result.rows[0];
}

/**
 * Finds a wallet by its unique database ID.
 * @param id - Wallet UUID
 * @returns The wallet object if found, or null otherwise.
 */
export async function findWalletById(id: string): Promise<Wallet | null> {
  const sql = `
    SELECT id, user_id, created_at, updated_at
    FROM wallets
    WHERE id = $1
  `;
  const result = await query(sql, [id]);
  return result.rows[0] || null;
}

/**
 * Finds a wallet by the user ID it belongs to.
 * @param userId - User UUID
 * @returns The wallet object if found, or null otherwise.
 */
export async function findWalletByUserId(userId: string, client?: PoolClient): Promise<Wallet | null> {
  const sql = `
    SELECT id, user_id, created_at, updated_at
    FROM wallets
    WHERE user_id = $1
  `;
  const result = client ? await client.query(sql, [userId]) : await query(sql, [userId]);
  return result.rows[0] || null;
}
