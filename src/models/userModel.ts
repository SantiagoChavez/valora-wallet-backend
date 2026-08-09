import type { PoolClient } from "pg";
import { query } from "../database/db";

export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  date_of_birth: Date | string | null;
  phone: string | null;
  password_reset_token_hash: string | null;
  password_reset_expires_at: Date | string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

/**
 * Creates a new user in the database.
 * @param email - User email address
 * @param passwordHash - Hashed password
 * @param firstName - User's first name
 * @param lastName - User's last name
 * @param client - Optional database client for transaction support
 * @returns The newly created user object.
 */
export async function createUser(
  email: string,
  passwordHash: string,
  firstName: string,
  lastName: string,
  dateOfBirth: string | null,
  phone: string | null,
  client?: PoolClient
): Promise<User> {
  const sql = `
    INSERT INTO users (email, password_hash, first_name, last_name, date_of_birth, phone)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, email, password_hash, first_name, last_name, date_of_birth, phone, created_at, updated_at
  `;
  const result = client
    ? await client.query(sql, [email, passwordHash, firstName, lastName, dateOfBirth, phone])
    : await query(sql, [email, passwordHash, firstName, lastName, dateOfBirth, phone]);
  if (result.rows.length === 0) {
    throw new Error("No se pudo registrar el usuario en la base de datos.");
  }
  return result.rows[0];
}

/**
 * Finds a user by their unique database ID.
 * @param id - User UUID
 * @returns The user object if found, or null otherwise.
 */
export async function findUserById(id: string): Promise<User | null> {
  const sql = `
    SELECT id, email, password_hash, first_name, last_name, date_of_birth, phone, created_at, updated_at
    FROM users
    WHERE id = $1
  `;
  const result = await query(sql, [id]);
  return result.rows[0] || null;
}

/**
 * Finds a user by their unique email address.
 * @param email - User email address
 * @returns The user object if found, or null otherwise.
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const sql = `
    SELECT id, email, password_hash, first_name, last_name, date_of_birth, phone, created_at, updated_at
    FROM users
    WHERE email = $1
  `;
  const result = await query(sql, [email]);
  return result.rows[0] || null;
}

/**
 * Stores a hashed password reset token and its expiration for a user, overwriting any previous one.
 * @param userId - User UUID
 * @param tokenHash - SHA-256 hash of the raw reset token (never store the raw token)
 * @param expiresAt - Expiration timestamp for the token
 */
export async function setPasswordResetToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date
): Promise<void> {
  const sql = `
    UPDATE users
    SET password_reset_token_hash = $1, password_reset_expires_at = $2
    WHERE id = $3
  `;
  await query(sql, [tokenHash, expiresAt, userId]);
}

/**
 * Finds a user by a non-expired password reset token hash.
 * @param tokenHash - SHA-256 hash of the raw reset token
 * @returns The user object if the token is valid and not expired, or null otherwise.
 */
export async function findUserByValidResetToken(tokenHash: string): Promise<User | null> {
  const sql = `
    SELECT id, email, password_hash, first_name, last_name, date_of_birth, phone, created_at, updated_at
    FROM users
    WHERE password_reset_token_hash = $1 AND password_reset_expires_at > NOW()
  `;
  const result = await query(sql, [tokenHash]);
  return result.rows[0] || null;
}

/**
 * Updates a user's password and invalidates their reset token (single-use).
 * @param userId - User UUID
 * @param passwordHash - New hashed password
 */
export async function resetPasswordAndClearToken(userId: string, passwordHash: string): Promise<void> {
  const sql = `
    UPDATE users
    SET password_hash = $1, password_reset_token_hash = NULL, password_reset_expires_at = NULL
    WHERE id = $2
  `;
  await query(sql, [passwordHash, userId]);
}
