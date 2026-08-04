import type { PoolClient } from "pg";
import { query } from "../database/db";
import { findWalletByUserId } from "./walletModel";


export interface Balance {
  id: string;
  wallet_id: string;
  currency_code: string;
  amount: string; // Since NUMERIC is returned as a string from node-pg to preserve precision
  created_at: string | Date;
  updated_at: string | Date;
}

/**
 * Creates or updates the balance for a wallet and currency.
 * @param walletId - Wallet UUID
 * @param currencyCode - Currency identifier (e.g. USD, EUR, ARS)
 * @param amount - Balance amount
 * @param client - Optional database client for transaction support
 * @returns The created or updated balance object.
 */
export async function createOrUpdateBalance(
  walletId: string,
  currencyCode: string,
  amount: string | number,
  client?: PoolClient
): Promise<Balance> {
  const sql = `
    INSERT INTO balances (wallet_id, currency_code, amount)
    VALUES ($1, $2, $3)
    ON CONFLICT (wallet_id, currency_code)
    DO UPDATE SET amount = EXCLUDED.amount, updated_at = CURRENT_TIMESTAMP
    RETURNING id, wallet_id, currency_code, amount, created_at, updated_at
  `;
  const result = client
    ? await client.query(sql, [walletId, currencyCode, amount.toString()])
    : await query(sql, [walletId, currencyCode, amount.toString()]);
  if (result.rows.length === 0) {
    throw new Error("No se pudo crear o actualizar el saldo en la base de datos.");
  }
  return result.rows[0];
}

/**
 * Retrieves all balances associated with a wallet.
 * @param walletId - Wallet UUID
 * @returns An array of balance objects.
 */
export async function findBalancesByWalletId(walletId: string): Promise<Balance[]> {
  const sql = `
    SELECT id, wallet_id, currency_code, amount, created_at, updated_at
    FROM balances
    WHERE wallet_id = $1
  `;
  const result = await query(sql, [walletId]);
  return result.rows;
}

/**
 * Retrieves a specific balance for a wallet and currency.
 * @param walletId - Wallet UUID
 * @param currencyCode - Currency identifier
 * @returns The balance object if found, or null otherwise.
 */
export async function findBalanceByWalletAndCurrency(
  walletId: string,
  currencyCode: string,
  client?: PoolClient
): Promise<Balance | null> {
  const sql = `
    SELECT id, wallet_id, currency_code, amount, created_at, updated_at
    FROM balances
    WHERE wallet_id = $1 AND currency_code = $2
  `;
  const result = client ? await client.query(sql, [walletId, currencyCode]) : await query(sql, [walletId, currencyCode]);
  return result.rows[0] || null;
}


/**
 * Retrieves the available balance of a specific currency for a user.
 * @param userId - The user's UUID
 * @param currencyCode - The currency code (e.g., 'USD', 'ARS')
 * @returns The balance as a number
 */
export async function getUserBalance(userId: string, currencyCode: string, client?: PoolClient): Promise<number> {
  const wallet = await findWalletByUserId(userId, client);
  if (!wallet) {
    throw new Error("Billetera no encontrada para el usuario.");
  }

  const balance = await findBalanceByWalletAndCurrency(wallet.id, currencyCode, client);
  return balance ? parseFloat(balance.amount) : 0;
}

/**
 * Safely updates a user's balance by applying a delta (increment/decrement) using an UPSERT strategy.
 * @param client - The database pool client for the transaction
 * @param walletId - The wallet UUID
 * @param currencyCode - The currency code
 * @param amountDelta - The amount to add (positive) or subtract (negative)
 * @returns The updated balance record
 */
export async function updateUserBalance(
  client: PoolClient,
  walletId: string,
  currencyCode: string,
  amountDelta: number
): Promise<Balance> {
  const existingBalance = await client.query(
    `
      SELECT id, wallet_id, currency_code, amount, created_at, updated_at
      FROM balances
      WHERE wallet_id = $1 AND currency_code = $2
    `,
    [walletId, currencyCode]
  );

  if (existingBalance.rows.length === 0) {
    if (amountDelta < 0) {
      throw new Error("Saldo insuficiente para realizar la operación.");
    }

    const insertSql = `
      INSERT INTO balances (wallet_id, currency_code, amount)
      VALUES ($1, $2, $3)
      RETURNING id, wallet_id, currency_code, amount, created_at, updated_at;
    `;
    const result = await client.query(insertSql, [walletId, currencyCode, amountDelta.toFixed(8)]);
    if (result.rows.length === 0) {
      throw new Error("No se pudo actualizar el saldo en la base de datos.");
    }
    return result.rows[0];
  }

  const currentAmount = parseFloat(existingBalance.rows[0].amount);
  const newAmount = currentAmount + amountDelta;

  if (newAmount < 0) {
    throw new Error("Saldo insuficiente para realizar la operación.");
  }

  const updateSql = `
    UPDATE balances
    SET amount = $3, updated_at = CURRENT_TIMESTAMP
    WHERE wallet_id = $1 AND currency_code = $2
    RETURNING id, wallet_id, currency_code, amount, created_at, updated_at;
  `;
  const result = await client.query(updateSql, [walletId, currencyCode, newAmount.toFixed(8)]);
  if (result.rows.length === 0) {
    throw new Error("No se pudo actualizar el saldo en la base de datos.");
  }
  return result.rows[0];
}