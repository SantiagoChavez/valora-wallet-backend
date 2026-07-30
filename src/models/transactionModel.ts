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
