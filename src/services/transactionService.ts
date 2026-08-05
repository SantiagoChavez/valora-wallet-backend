import { pool } from "../database/db.js";
import { findWalletByUserId } from "../models/walletModel.js";
import { getUserBalance, updateUserBalance } from "../models/balanceModel.js";
import { insertTransaction, findTransactionsByWalletId, countTransactionsByWalletId } from "../models/transactionModel.js";
import { getExchangeRates } from "./exchangeRateService.js";

/**
 * Executes a deposit transaction securely using ACID properties.
 * @param userId - The user's UUID
 * @param currency - The deposit currency
 * @param amount - The deposit amount
 * @returns The recorded transaction
 */
export async function executeDeposit(userId: string, currency: string, amount: number) {
    if (amount <= 0) throw new Error("El monto a depositar debe ser mayor a cero.");

    const wallet = await findWalletByUserId(userId);
    if (!wallet) throw new Error("Billetera no encontrada.");

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const updatedBalance = await updateUserBalance(client, wallet.id, currency, amount);
        const transaction = await insertTransaction(
            client, wallet.id, "DEPOSIT", null, currency, null, amount, null, updatedBalance.amount
        );

        await client.query("COMMIT");
        return transaction;
    } catch (error: unknown) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Executes a currency exchange ensuring sufficient funds and atomic updates.
 * @param userId - The user's UUID
 * @param fromCurrency - Source currency
 * @param toCurrency - Destination currency
 * @param amount - Amount to exchange
 * @returns The recorded transaction
 */
export async function executeExchange(userId: string, fromCurrency: string, toCurrency: string, amount: number) {
    if (amount <= 0) throw new Error("El monto a intercambiar debe ser mayor a cero.");
    if (fromCurrency === toCurrency) throw new Error("Las monedas de origen y destino no pueden ser iguales.");

    const wallet = await findWalletByUserId(userId);
    if (!wallet) throw new Error("Billetera no encontrada.");

    // Fetch exchange rates from Day 1 service BEFORE acquiring DB connection
    const rates = await getExchangeRates();
    const rateFrom = rates[fromCurrency];
    const rateTo = rates[toCurrency];

    if (!rateFrom || !rateTo) {
        throw new Error("Tasa de cambio no disponible para las monedas seleccionadas.");
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Business Validation: Check sufficient funds
        const currentBalance = await getUserBalance(userId, fromCurrency, client);
        if (currentBalance < amount) {
            throw new Error("Saldo insuficiente para realizar la operación.");
        }

        // Mathematical logic for exchange
        const amountInUsd = amount / rateFrom;
        const targetAmount = amountInUsd * rateTo;
        const exchangeRate = rateTo / rateFrom;

        // Deduct from source currency (negative amount)
        await updateUserBalance(client, wallet.id, fromCurrency, -amount);
        
        // Add to target currency (positive amount)
        const newTargetBalance = await updateUserBalance(client, wallet.id, toCurrency, targetAmount);

        // Record the operation in the ledger
        const transaction = await insertTransaction(
            client, wallet.id, "EXCHANGE", fromCurrency, toCurrency, amount, targetAmount, exchangeRate, newTargetBalance.amount
        );

        await client.query("COMMIT");
        return transaction;
    } catch (error: unknown) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Recupera el historial de transacciones paginado del usuario.
 * @param userId - UUID del usuario
 * @param limit - Límite de transacciones por página
 * @param page - Número de página actual (1-indexed)
 * @param type - Tipo opcional de transacción a filtrar
 */
export async function getUserTransactions(
    userId: string,
    limit: number = 20,
    page: number = 1,
    type?: string
) {
    const wallet = await findWalletByUserId(userId);
    if (!wallet) {
        throw new Error("Billetera no encontrada.");
    }

    const offset = (page - 1) * limit;
    const [transactions, totalCount] = await Promise.all([
        findTransactionsByWalletId(wallet.id, limit, offset, type),
        countTransactionsByWalletId(wallet.id, type)
    ]);

    return {
        transactions,
        pagination: {
            page: page,
            limit: limit,
            totalCount: totalCount,
            totalPages: Math.ceil(totalCount / limit)
        }
    };
}