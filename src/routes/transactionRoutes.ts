import { Router } from "express";
import { depositController, exchangeController } from "../controllers/transactionController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

export const transactionRouter = Router();

transactionRouter.post("/deposit", authMiddleware, depositController);
transactionRouter.post("/exchange", authMiddleware, exchangeController);