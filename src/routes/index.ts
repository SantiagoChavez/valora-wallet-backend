import { Router } from "express";
import { authRouter } from "./authRoutes.js";
import { transactionRouter } from "./transactionRoutes.js";
import { balanceRouter } from "./balanceRoutes.js";
import { chatbotRouter } from "./chatbotRoutes.js";
import { walletRouter } from "./walletRoutes.js";
import { catalogRouter } from "./catalogRoutes.js";

export const router = Router();

router.get("/", (_req, res) => {
  res.json({
    name: "Valora Wallet API",
    status: "running",
    version: "1.0.0",
    message: "Bienvenido al Backend de Valora Wallet. Sistema operativo y escuchando peticiones."
  });
});

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.use("/auth", authRouter);
router.use("/transactions", transactionRouter);
router.use("/balances", balanceRouter);
router.use("/chatbot", chatbotRouter);
router.use("/wallet", walletRouter);
router.use("/catalogs", catalogRouter);