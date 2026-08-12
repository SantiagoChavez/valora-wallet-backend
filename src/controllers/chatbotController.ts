import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../middlewares/authMiddleware.js";
import { initializeAndGetBalances } from "../services/balanceService.js";
import { getFinancialAdvice } from "../services/geminiService.js";
import { getUserTransactions } from "../services/transactionService.js";
import { getExchangeRates, type ExchangeRates } from "../services/exchangeRateService.js";
import { deleteChatHistoryByUserId } from "../models/chatbotModel.js";

// Interfaz sugerida para tipar el resultado (Pilar 4)
type ExchangeRatesResult = ExchangeRates | { error: string };

/**
 * Controlador para manejar las consultas al asistente financiero con IA.
 */
export async function chatController(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        // Pilar 5: DRY. Asumimos el contrato del AuthMiddleware. El userId siempre existirá aquí.
        const userId = req.user!.userId;
        const { message } = req.body;

        if (!message || typeof message !== "string" || message.trim() === "") {
            res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "El mensaje no puede estar vacío." });
            return;
        }

        const [balances, transactions, exchangeRatesResult] = await Promise.all([
            initializeAndGetBalances(userId),
            getUserTransactions(userId, 20, 1),
            getExchangeRates().catch(e => {
                console.warn("No se pudieron obtener las cotizaciones para el chatbot:", e);
                return { error: "Cotizaciones no disponibles temporalmente" };
            })
        ]);

        // Pilar 6: Defensa matemática. Fallback a 0 si parseFloat falla devolviendo NaN.
        const formattedBalances = balances.reduce((acc, b) => {
            acc[b.currency_code] = parseFloat(b.amount) || 0;
            return acc;
        }, {} as Record<string, number>);

        const aiResponse = await getFinancialAdvice(
            message.trim(),
            formattedBalances,
            {
                transactions: transactions,
                exchangeRatesResult: exchangeRatesResult as ExchangeRatesResult
            }
        );

        res.status(200).json({
            success: true,
            data: {
                reply: aiResponse
            }
        });
    } catch (error: unknown) {
        next(error);
    }
}

/**
 * Controlador para resetear el historial del chatbot.
 */
export async function resetChatController(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        // Pilar 5: DRY. 
        const userId = req.user!.userId;

        await deleteChatHistoryByUserId(userId);

        res.status(200).json({
            success: true,
            message: "Historial de chat borrado exitosamente."
        });
    } catch (error: unknown) {
        next(error);
    }
}