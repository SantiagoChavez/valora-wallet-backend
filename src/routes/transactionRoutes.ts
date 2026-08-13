import { Router } from "express";
import rateLimit from "express-rate-limit";
import { depositController, exchangeController, getTransactionsController, buyController, sellController, quoteController, resolveTransferController, transferController } from "../controllers/transactionController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { requireCompleteProfile } from "../middlewares/requireCompleteProfile.js";
import { validateSchema } from "../middlewares/validateSchema.js";
import { depositSchema, exchangeSchema, getTransactionsQuerySchema, quoteSchema, resolveUserSchema, transferSchema } from "../schemas/transactionSchema.js";

export const transactionRouter = Router();

const transactionReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "TooManyRequestsError",
    message: "Demasiadas consultas. Probá de nuevo más tarde.",
  },
});

const transferLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "TooManyRequestsError",
    message: "Demasiados intentos de transferencia. Probá de nuevo más tarde.",
  },
});

// requireCompleteProfile solo va en las operaciones que mueven plata (depositar, comprar,
// vender, intercambiar, transferir) — no en /quote (cotizar es de solo lectura, no hace falta tener
// el perfil completo para consultar precio) ni en el listado de transacciones.
transactionRouter.post("/deposit", authMiddleware, requireCompleteProfile, validateSchema(depositSchema, { errorCode: "VALIDATION_ERROR", includeIssues: false }), depositController);
transactionRouter.post("/quote", authMiddleware, validateSchema(quoteSchema, { errorCode: "VALIDATION_ERROR", includeIssues: false }), quoteController);
transactionRouter.post("/exchange", authMiddleware, requireCompleteProfile, validateSchema(exchangeSchema, { errorCode: "VALIDATION_ERROR", includeIssues: false }), exchangeController);
transactionRouter.post("/buy", authMiddleware, requireCompleteProfile, validateSchema(exchangeSchema, { errorCode: "VALIDATION_ERROR", includeIssues: false }), buyController);
transactionRouter.post("/sell", authMiddleware, requireCompleteProfile, validateSchema(exchangeSchema, { errorCode: "VALIDATION_ERROR", includeIssues: false }), sellController);
transactionRouter.get("/", transactionReadLimiter, authMiddleware, validateSchema(getTransactionsQuerySchema, { errorCode: "VALIDATION_ERROR", includeIssues: false }, "query"), getTransactionsController);

// Rutas de Transferencia
transactionRouter.post("/transfer/resolve", authMiddleware, transferLimiter, validateSchema(resolveUserSchema, { errorCode: "VALIDATION_ERROR", includeIssues: true }), resolveTransferController);
transactionRouter.post("/transfer", authMiddleware, requireCompleteProfile, transferLimiter, validateSchema(transferSchema, { errorCode: "VALIDATION_ERROR", includeIssues: true }), transferController);