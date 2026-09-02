import type { PoolClient } from "pg";
import { pool } from "../database/db.js";
import { generateValidCardNumber, generateCvv, generateExpiry } from "../utils/cardGenerator.js";

export interface Card {
  id: string;
  wallet_id: string;
  card_number: string;
  holder_name: string;
  expiry_month: string;
  expiry_year: string;
  cvv: string;
  brand: string;
  card_type: "VIRTUAL" | "PHYSICAL";
  label: string;
  is_frozen: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CardResponse {
  id: string;
  walletId: string;
  cardNumber: string;
  maskedNumber: string;
  holderName: string;
  expiry: string;
  cvv: string;
  brand: string;
  cardType: "VIRTUAL" | "PHYSICAL";
  label: string;
  isFrozen: boolean;
  createdAt: string;
}

export function toCardResponse(card: Card, maskSensitiveData = true): CardResponse {
  const maskedNumber = `•••• •••• •••• ${card.card_number.slice(-4)}`;
  return {
    id: card.id,
    walletId: card.wallet_id,
    cardNumber: maskSensitiveData ? maskedNumber : card.card_number,
    maskedNumber,
    holderName: card.holder_name,
    expiry: `${card.expiry_month}/${card.expiry_year}`,
    cvv: maskSensitiveData ? "•••" : card.cvv,
    brand: card.brand,
    cardType: card.card_type,
    label: card.label,
    isFrozen: card.is_frozen,
    createdAt: card.created_at.toISOString(),
  };
}

export async function createCard(
  walletId: string,
  holderName: string,
  label = "Tarjeta Principal",
  brand = "VALORA PLATINUM",
  cardType: "VIRTUAL" | "PHYSICAL" = "VIRTUAL",
  client?: PoolClient
): Promise<Card> {
  const executor = client || pool;
  const cardNumber = generateValidCardNumber();
  const cvv = generateCvv();
  const { month, year } = generateExpiry();

  const result = await executor.query<Card>(
    `INSERT INTO cards (
      wallet_id, card_number, holder_name, expiry_month, expiry_year, cvv, brand, card_type, label
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, wallet_id, card_number, holder_name, expiry_month, expiry_year, cvv, brand, card_type, label, is_frozen, created_at, updated_at`,
    [walletId, cardNumber, holderName, month, year, cvv, brand, cardType, label]
  );

  return result.rows[0];
}

export async function findCardsByWalletId(walletId: string): Promise<Card[]> {
  const result = await pool.query<Card>(
    `SELECT id, wallet_id, card_number, holder_name, expiry_month, expiry_year, cvv, brand, card_type, label, is_frozen, created_at, updated_at
     FROM cards
     WHERE wallet_id = $1
     ORDER BY created_at ASC`,
    [walletId]
  );
  return result.rows;
}

export async function findCardByIdAndWalletId(cardId: string, walletId: string): Promise<Card | null> {
  const result = await pool.query<Card>(
    `SELECT id, wallet_id, card_number, holder_name, expiry_month, expiry_year, cvv, brand, card_type, label, is_frozen, created_at, updated_at
     FROM cards
     WHERE id = $1 AND wallet_id = $2`,
    [cardId, walletId]
  );
  return result.rows[0] || null;
}

export async function countCardsByWalletId(walletId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM cards WHERE wallet_id = $1`,
    [walletId]
  );
  return parseInt(result.rows[0]?.count || "0", 10);
}

export async function toggleFreezeCard(cardId: string, walletId: string): Promise<Card | null> {
  const result = await pool.query<Card>(
    `UPDATE cards
     SET is_frozen = NOT is_frozen, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND wallet_id = $2
     RETURNING id, wallet_id, card_number, holder_name, expiry_month, expiry_year, cvv, brand, card_type, label, is_frozen, created_at, updated_at`,
    [cardId, walletId]
  );
  return result.rows[0] || null;
}

export async function deleteCard(cardId: string, walletId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM cards WHERE id = $1 AND wallet_id = $2`,
    [cardId, walletId]
  );
  return (result.rowCount ?? 0) > 0;
}
