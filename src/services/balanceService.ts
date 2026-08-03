import { findBalancesByWalletId, createOrUpdateBalance } from "../models/balanceModel.js";
import { findWalletByUserId } from "../models/walletModel.js";
import { pool } from "../database/db.js";

const REQUIRED_CURRENCIES = ["USD", "EUR", "ARS"];

/**
 * Retrieves all balances for a user, initializing missing required currencies to zero.
 * @param userId - The user's UUID
 * @returns An array of balance objects
 */
export async function initializeAndGetBalances(userId: string) {
    const wallet = await findWalletByUserId(userId);
    if (!wallet) {
        throw new Error("Billetera no encontrada para el usuario.");
    }

    const existingBalances = await findBalancesByWalletId(wallet.id);
    const existingCurrencyCodes = existingBalances.map(b => b.currency_code);

    const missingCurrencies = REQUIRED_CURRENCIES.filter(
        currency => !existingCurrencyCodes.includes(currency)
    );

    // Si faltan monedas, inicialízalas dentro de una transacción.
    if (missingCurrencies.length > 0) {
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            for (const currency of missingCurrencies) {
                await createOrUpdateBalance(wallet.id, currency, "0.00000000", client);
            }
            await client.query("COMMIT");
        } catch (error: unknown) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    }

    return await findBalancesByWalletId(wallet.id);
}