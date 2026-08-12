import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../middlewares/authMiddleware.js";
import type { Transaction } from "../models/transactionModel.js";
import { executeDeposit, executeExchange, getUserTransactions, executeBuy, executeSell, getExchangeQuote, resolveTransferDestination, executeTransfer } from "../services/transactionService.js";
import type { GetTransactionsQuery } from "../schemas/transactionSchema.js";

/**
 * Maps a database transaction record (snake_case) to an API DTO (camelCase).
 * @param tx - The raw transaction object from the database
 * @returns The mapped object
 */
/**
 * Helper to mask email addresses for privacy.
 * Muestra los dos primeros caracteres del local part, luego *** y el dominio completo.
 */
function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const maskedLocal = local.length > 2 ? `${local.slice(0, 2)}***` : `${local}***`;
  return `${maskedLocal}@${domain}`;
}

/**
 * Maps a database transaction record (snake_case) to an API DTO (camelCase).
 * The counterparty email is masked to avoid leaking PII.
 */
const mapTransactionToCamelCase = (tx: Transaction) => ({
    id: tx.id,
    walletId: tx.wallet_id,
    transactionType: tx.transaction_type,
    sourceCurrency: tx.source_currency,
    targetCurrency: tx.target_currency,
    // FIX: Eliminamos el parseFloat().toFixed() redundante.
    // TRADEOFF: Casteamos el NUMERIC estricto de PostgreSQL a Number de JS.
    // Es seguro para montos normales, pero montos colosales (>90 millones con 8 decimales) podrían perder precisión por el límite IEEE 754.
    sourceAmount: tx.source_amount ? Number(tx.source_amount) : null,
    targetAmount: tx.target_amount ? Number(tx.target_amount) : null,
    exchangeRate: tx.exchange_rate ? Number(tx.exchange_rate) : null,
    resultingBalance: tx.resulting_balance ? Number(tx.resulting_balance) : null,
    createdAt: tx.created_at,
    counterpartyId: tx.counterparty_id ?? null,
    counterpartyName: tx.counterparty_name ?? null,
    counterpartyLastName: tx.counterparty_last_name ?? null,
    counterpartyEmail: maskEmail(tx.counterparty_email ?? null),
    counterpartyWallet: tx.counterparty_wallet ?? null,
});


/**
 * Controller to handle deposit requests.
 */
export async function depositController(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const { currency, amount } = req.body;

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
 * Controller to handle quote requests.
 */
export async function quoteController(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const { fromCurrency, toCurrency, amount } = req.body;
        const quote = await getExchangeQuote(fromCurrency, toCurrency, amount);

        res.status(200).json({
            success: true,
            data: quote
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
        const userId = req.user!.userId;
        const { fromCurrency, toCurrency, amount } = req.body;

        const transaction = await executeExchange(userId, fromCurrency, toCurrency, amount);

        res.status(200).json({
            success: true,
            data: mapTransactionToCamelCase(transaction)
        });
    } catch (error: unknown) {
        next(error);
    }
}

/**
 * Controlador para obtener el historial de transacciones paginado del usuario.
 */
export async function getTransactionsController(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.user!.userId;

        // Extraer los query params ya validados y parseados por el middleware validateSchema
        const { limit, page, type } = req.validatedQuery as unknown as GetTransactionsQuery;

        const result = await getUserTransactions(userId, limit, page, type);
        const mappedTransactions = result.transactions.map(mapTransactionToCamelCase);

        res.status(200).json({
            success: true,
            data: mappedTransactions,
            pagination: result.pagination
        });
    } catch (error: unknown) {
        next(error);
    }
}

/**
 * Controller to handle buy requests.
 */
export async function buyController(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const { fromCurrency, toCurrency, amount } = req.body;

        const transaction = await executeBuy(userId, fromCurrency, toCurrency, amount);

        res.status(200).json({
            success: true,
            data: mapTransactionToCamelCase(transaction)
        });
    } catch (error: unknown) {
        next(error);
    }
}

/**
 * Controller to handle sell requests.
 */
export async function sellController(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const { fromCurrency, toCurrency, amount } = req.body;

        const transaction = await executeSell(userId, fromCurrency, toCurrency, amount);

        res.status(200).json({
            success: true,
            data: mapTransactionToCamelCase(transaction)
        });
    } catch (error: unknown) {
        next(error);
    }
}

/**
 * Controller to handle resolving a transfer destination by identifier (email, cvu, alias).
 */
export async function resolveTransferController(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const MIN_RESPONSE_MS = 300; // tiempo mínimo de respuesta normalizado

    try {
        const { identifier } = req.body;
        const destination = await resolveTransferDestination(identifier);

        const elapsedTime = Date.now() - startTime;
        if (elapsedTime < MIN_RESPONSE_MS) {
            await new Promise(resolve => setTimeout(resolve, MIN_RESPONSE_MS - elapsedTime));
        }

        res.status(200).json({
            success: true,
            data: {
                firstName: destination.first_name,
                lastName: destination.last_name,
                alias: destination.alias,
                // FIX: Usar la función top-level maskEmail (acepta string | null)
                cvu: destination.cvu ? `***${destination.cvu.slice(-4)}` : null,
                email: maskEmail(destination.email)
            }
        });
    } catch (error: unknown) {
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime < MIN_RESPONSE_MS) {
            await new Promise(resolve => setTimeout(resolve, MIN_RESPONSE_MS - elapsedTime));
        }
        next(error);
    }
}

/**
 * Controller to handle executing a transfer to a third party.
 */
export async function transferController(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user!.userId;
        const { currency, amount, destination } = req.body;

        const transaction = await executeTransfer(userId, currency, amount, destination);

        res.status(200).json({
            success: true,
            data: mapTransactionToCamelCase(transaction)
        });
    } catch (error: unknown) {
        next(error);
    }
}