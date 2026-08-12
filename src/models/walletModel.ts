import type { PoolClient } from "pg";
import { query } from "../database/db.js";

// FIX: Prefijo 'node:' obligatorio en ESM para prevenir ataques de supply chain o resolución errónea
import crypto from "node:crypto";

export interface Wallet {
  id: string;
  user_id: string;
  cvu: string;
  alias: string;
  created_at: string | Date;
  updated_at: string | Date;
}

// FIX: Interfaz explícita para evitar inferencia de 'any'
export interface WalletAndUser {
  wallet_id: string;
  cvu: string;
  alias: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
}

/**
 * Genera un CVU simulado criptográficamente seguro de 22 dígitos.
 */
export const generateCVU = (): string => {
  let cvu = '';
  for (let i = 0; i < 22; i++) {
    cvu += crypto.randomInt(0, 10).toString();
  }
  return cvu;
};

/**
 * Genera un alias simulado único y seguro.
 */
export const generateAlias = (firstName: string): string => {
  let cleanName = firstName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
    
  // FIX: Protección contra strings vacíos por caracteres no latinos o emojis
  if (!cleanName || cleanName.length === 0) {
    cleanName = "user";
  }
    
  const randomSuffix = crypto.randomInt(0, 1000).toString().padStart(3, '0');
  return `valora.${cleanName}.${randomSuffix}`;
};

/**
 * Creates a new wallet for a user, handling CVU/Alias generation and DB collision retries.
 */
export async function createWallet(userId: string, firstName: string, client?: PoolClient): Promise<Wallet> {
  const sql = `
    INSERT INTO wallets (user_id, cvu, alias)
    VALUES ($1, $2, $3)
    RETURNING id, user_id, cvu, alias, created_at, updated_at
  `;
  
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    try {
      const cvu = generateCVU();
      const alias = generateAlias(firstName);
      
      const result = client 
        ? await client.query(sql, [userId, cvu, alias]) 
        : await query(sql, [userId, cvu, alias]);
        
      if (result.rows.length === 0) {
        throw new Error("No se pudo crear la billetera en la base de datos.");
      }
      return result.rows[0] as Wallet;
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && 'constraint' in error) {
        const pgError = error as { code: string; constraint: string };
        if (pgError.code === "23505" && (pgError.constraint === "wallets_cvu_key" || pgError.constraint === "wallets_alias_key")) {
          attempts++;
          if (attempts >= maxAttempts) {
            throw new Error("No se pudo generar un CVU/Alias único después de múltiples intentos.");
          }
          continue;
        }
      }
      throw error;
    }
  }
  
  throw new Error("Unexpected error in createWallet loop");
}

/**
 * Finds a wallet by its unique database ID.
 */
export async function findWalletById(id: string): Promise<Wallet | null> {
  const sql = `
    SELECT id, user_id, cvu, alias, created_at, updated_at
    FROM wallets
    WHERE id = $1
  `;
  const result = await query(sql, [id]);
  return (result.rows[0] as Wallet) || null;
}

/**
 * Finds a wallet by the user ID it belongs to.
 */
export async function findWalletByUserId(userId: string, client?: PoolClient): Promise<Wallet | null> {
  const sql = `
    SELECT id, user_id, cvu, alias, created_at, updated_at
    FROM wallets
    WHERE user_id = $1
  `;
  const result = client ? await client.query(sql, [userId]) : await query(sql, [userId]);
  return (result.rows[0] as Wallet) || null;
}

/**
 * Updates a wallet's alias.
 */
export async function updateWalletAlias(walletId: string, newAlias: string): Promise<Wallet | null> {
  const sql = `
    UPDATE wallets
    SET alias = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING id, user_id, cvu, alias, created_at, updated_at
  `;
  const result = await query(sql, [newAlias, walletId]);
  return (result.rows[0] as Wallet) || null;
}

/**
 * Encuentra una billetera y los datos de su dueño buscando por email, cvu o alias.
 */
// FIX: Asignado el tipo de retorno explícito 'Promise<WalletAndUser | null>' para blindar el Frontend
export async function findWalletAndUserByIdentifier(identifier: string): Promise<WalletAndUser | null> {
  const cleanIdentifier = identifier.trim().toLowerCase();
  const sql = `
    SELECT 
      w.id AS wallet_id,
      w.cvu,
      w.alias,
      u.id AS user_id,
      u.first_name,
      u.last_name,
      u.email
    FROM wallets w
    JOIN users u ON w.user_id = u.id
    WHERE LOWER(u.email) = $1 OR w.cvu = $1 OR LOWER(w.alias) = $1
  `;
  const result = await query(sql, [cleanIdentifier]);
  return (result.rows[0] as WalletAndUser) || null;
}
