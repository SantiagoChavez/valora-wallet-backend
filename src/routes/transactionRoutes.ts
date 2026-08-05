import { Router } from "express";
import { depositController, exchangeController, getTransactionsController } from "../controllers/transactionController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { validateSchema } from "../middlewares/validateSchema.js";
import { depositSchema, exchangeSchema, getTransactionsQuerySchema } from "../schemas/transactionSchema.js";

export const transactionRouter = Router();

transactionRouter.post("/deposit", authMiddleware, validateSchema(depositSchema, { errorCode: "VALIDATION_ERROR", includeIssues: false }), depositController);
transactionRouter.post("/exchange", authMiddleware, validateSchema(exchangeSchema, { errorCode: "VALIDATION_ERROR", includeIssues: false }), exchangeController);
transactionRouter.get("/", authMiddleware, validateSchema(getTransactionsQuerySchema, { errorCode: "VALIDATION_ERROR", includeIssues: true }, "query"), getTransactionsController);