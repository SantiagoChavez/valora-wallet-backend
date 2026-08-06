import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../middlewares/authMiddleware.js";
import { initializeAndGetBalances } from "../services/balanceService.js";
import { getFinancialAdvice } from "../services/geminiService.js";

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

        // Validación de seguridad básica
        if (!userId) {
            res.status(401).json({ success: false, error: "AUTH_ERROR", message: "Usuario no autorizado." });
            return;
        }

        // Validación de entrada
        if (!message || typeof message !== "string") {
            res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "El mensaje es requerido." });
            return;
        }

        // 1. Inyección Contextual: Obtenemos los saldos reales del usuario
        const balances = await initializeAndGetBalances(userId);

        // Formateamos los saldos a un objeto clave-valor simple para la IA (ej: { USD: 100, ARS: 50000 })
        const formattedBalances = balances.reduce((acc, b) => {
            acc[b.currency_code] = parseFloat(b.amount);
            return acc;
        }, {} as Record<string, number>);

        // 2. Consulta a Gemini pasando el mensaje y el contexto financiero
        const aiResponse = await getFinancialAdvice(message, formattedBalances);

        // 3. Respuesta en formato estandarizado (camelCase)
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