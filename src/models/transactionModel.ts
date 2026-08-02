import type { PoolClient } from "pg";

export interface Transaction {
  id: string;
  wallet_id: string;
  transaction_type: 'BUY' | 'SELL' | 'EXCHANGE' | 'DEPOSIT';
  source_currency: string | null;
  target_currency: string | null;
  source_amount: string | null; // NUMERIC is returned as a string from node-pg to preserve precision
  target_amount: string | null;
  exchange_rate: string | null;
  resulting_balance: string | null;
  created_at: string | Date;
}

/**
 * Inserts a new transaction record into the database.
 * @param client - The database pool client to ensure transaction atomicity
 * @param walletId - The wallet UUID
 * @param type - The transaction type
 * @param sourceCurrency - The origin currency
 * @param targetCurrency - The destination currency
 * @param sourceAmount - The deducted amount
 * @param targetAmount - The credited amount
 * @param exchangeRate - The applied conversion rate
 * @param resultingBalance - The final balance of the target currency
 * @returns The created transaction record
 */

export async function insertTransaction(
  client: PoolClient,
  walletId: string,
  type: 'BUY' | 'SELL' | 'EXCHANGE' | 'DEPOSIT',
  sourceCurrency: string | null,
  targetCurrency: string | null,
  sourceAmount: number | string | null,
  targetAmount: number | string | null,
  exchangeRate: number | string | null,
  resultingBalance: number | string | null
){
  const sql = `
    INSERT INTO transactions 
    (wallet_id, transaction_type, source_currency, target_currency, source_amount, target_amount, exchange_rate, resulting_balance)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *;
  `;

  const values = [
    walletId,
    type,
    sourceCurrency,
    targetCurrency,
    sourceAmount?.toString(),
    targetAmount?.toString(),
    exchangeRate?.toString(),
    resultingBalance?.toString()
  ];

  const result = await client.query(sql, values);
  return result.rows[0];
}