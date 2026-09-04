import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { chatController, resetChatController } from "../controllers/chatbotController.js";
import { authMiddleware, type AuthenticatedRequest } from "../middlewares/authMiddleware.js";

import { validateSchema } from "../middlewares/validateSchema.js";
import { chatbotMessageSchema } from "../schemas/chatbotSchema.js";

export const chatbotRouter = Router();

// El rate limit global de app.ts (100 req/15min por IP) no distingue rutas gratis (/health) de
// esta, que es la única que factura contra la API de Gemini — con esto, alguien no puede agotar
// la cuota paga solo porque comparte IP con tráfico normal. Se limita por usuario (no por IP),
// ya que la ruta ya exige autenticación y así cada cuenta tiene su propio presupuesto.
const chatMessageLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req as AuthenticatedRequest).user?.userId ?? (req.ip ? ipKeyGenerator(req.ip) : "unknown"),
    message: {
        success: false,
        error: "TooManyRequestsError",
        message: "Demasiados mensajes al asistente. Probá de nuevo en unos minutos.",
    },
});

// Endpoint protegido para enviar mensajes al asistente
chatbotRouter.post(
    "/message",
    authMiddleware,
    chatMessageLimiter,
    validateSchema(chatbotMessageSchema),
    chatController
);

// Endpoint protegido para resetear el historial del chatbot
chatbotRouter.post(
    "/reset",
    authMiddleware,
    resetChatController
);