import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../middlewares/authMiddleware.js";
import type { Transaction } from "../models/transactionModel.js";
import { executeDeposit, executeExchange } from "../services/transactionService.js";

/**
 * Maps a database transaction record (snake_case) to an API DTO (camelCase).
 * @param tx - The raw transaction object from the database
 * @returns The mapped object
 */
const mapTransactionToCamelCase = (tx: Transaction) => ({
    id: tx.id,
    walletId: tx.wallet_id,
    transactionType: tx.transaction_type,
    sourceCurrency: tx.source_currency,
    targetCurrency: tx.target_currency,
    sourceAmount: tx.source_amount ? parseFloat(tx.source_amount) : null,
    targetAmount: tx.target_amount ? parseFloat(tx.target_amount) : null,
    exchangeRate: tx.exchange_rate ? parseFloat(tx.exchange_rate) : null,
    resultingBalance: tx.resulting_balance ? parseFloat(tx.resulting_balance) : null,
    createdAt: tx.created_at,
});

/**
 * Controller to handle deposit requests.
 */
export async function depositController(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user?.userId;
        const { currency, amount } = req.body;

        if (!userId) {
            res.status(401).json({ success: false, error: "AUTH_ERROR", message: "Usuario no autorizado." });
            return;
        }

        if (typeof currency !== "string" || currency.trim() === "") {
            res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "La moneda es obligatoria." });
            return;
        }

        if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
            res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "El monto debe ser un número mayor a cero." });
            return;
        }

        const transaction = await executeDeposit(userId, currency, amount);

        res.status(200).json({
            success: true,
            data: mapTransactionToCamelCase(transaction)
        });
    } catch (error: unknown) {
        next(error);
    }
}

/**
 * Controller to handle exchange requests.
 */
export async function exchangeController(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user?.userId;
        const { fromCurrency, toCurrency, amount } = req.body;

        if (!userId) {
            res.status(401).json({ success: false, error: "AUTH_ERROR", message: "Usuario no autorizado." });
            return;
        }

        if (typeof fromCurrency !== "string" || fromCurrency.trim() === "") {
            res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "La moneda de origen es obligatoria." });
            return;
        }

        if (typeof toCurrency !== "string" || toCurrency.trim() === "") {
            res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "La moneda de destino es obligatoria." });
            return;
        }

        if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
            res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "El monto debe ser un número mayor a cero." });
            return;
        }

        const transaction = await executeExchange(userId, fromCurrency, toCurrency, amount);

        res.status(200).json({
            success: true,
            data: mapTransactionToCamelCase(transaction)
        });
    } catch (error: unknown) {
        next(error);
    }
}