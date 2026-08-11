import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../middlewares/authMiddleware.js";
import { initializeAndGetBalances } from "../services/balanceService.js";
import { getFinancialAdvice } from "../services/geminiService.js";
import { getUserTransactions } from "../services/transactionService.js";
import { getExchangeRates } from "../services/exchangeRateService.js";
import { deleteChatHistoryByUserId } from "../models/chatbotModel.js";

/**
 * Controlador para manejar las consultas al asistente financiero con IA.
 */
export async function chatController(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.user?.userId;
        const { message } = req.body;

        if (!userId) {
            res.status(401).json({ success: false, error: "AUTH_ERROR", message: "Usuario no autorizado." });
            return;
        }

        // 1. Inyección Contextual: Obtenemos los saldos reales del usuario
        const balances = await initializeAndGetBalances(userId);
        const formattedBalances = balances.reduce((acc, b) => {
            acc[b.currency_code] = parseFloat(b.amount);
            return acc;
        }, {} as Record<string, number>);

        // 2. Historial de Transacciones (últimas 20)
        const transactions = await getUserTransactions(userId, 20, 1);

        // 3. Cotizaciones Actuales
        let exchangeRates: any = {};
        try {
            exchangeRates = await getExchangeRates();
        } catch (e) {
            console.warn("No se pudieron obtener las cotizaciones para el chatbot:", e);
            exchangeRates = { error: "Cotizaciones no disponibles temporalmente" };
        }

        // 4. Consulta a Gemini pasando el mensaje y el contexto financiero
        const aiResponse = await getFinancialAdvice(
            userId,
            message,
            formattedBalances,
            transactions,
            exchangeRates
        );

        // 5. Respuesta en formato estandarizado
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
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({ success: false, error: "AUTH_ERROR", message: "Usuario no autorizado." });
            return;
        }

        await deleteChatHistoryByUserId(userId);

        res.status(200).json({
            success: true,
            message: "Historial de chat borrado exitosamente."
        });
    } catch (error: unknown) {
        next(error);
    }
}