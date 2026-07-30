import { query } from "../database/db";

export interface Balance {
  id: string;
  wallet_id: string;
  currency_code: string;
  amount: string; // Since NUMERIC is returned as a string from node-pg to preserve precision
  created_at: Date;
  updated_at: Date;
}

/**
 * Creates or updates the balance for a wallet and currency.
 * @param walletId - Wallet UUID
 * @param currencyCode - Currency identifier (e.g. USD, EUR, ARS)
 * @param amount - Balance amount
 * @returns The created or updated balance object.
 */
export async function createOrUpdateBalance(
  walletId: string,
  currencyCode: string,
  amount: string | number
): Promise<Balance> {
  const sql = `
    INSERT INTO balances (wallet_id, currency_code, amount)
    VALUES ($1, $2, $3)
    ON CONFLICT (wallet_id, currency_code)
    DO UPDATE SET amount = EXCLUDED.amount, updated_at = CURRENT_TIMESTAMP
    RETURNING id, wallet_id, currency_code, amount, created_at, updated_at
  `;
  const result = await query(sql, [walletId, currencyCode, amount.toString()]);
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
  currencyCode: string
): Promise<Balance | null> {
  const sql = `
    SELECT id, wallet_id, currency_code, amount, created_at, updated_at
    FROM balances
    WHERE wallet_id = $1 AND currency_code = $2
  `;
  const result = await query(sql, [walletId, currencyCode]);
  return result.rows[0] || null;
}
