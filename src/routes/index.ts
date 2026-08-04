import { Router } from "express";
import { authRouter } from "./authRoutes.js";
import { transactionRouter } from "./transactionRoutes.js";
import { balanceRouter } from "./balanceRoutes.js";

export const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.use("/auth", authRouter);
router.use("/transactions", transactionRouter);
router.use("/balances", balanceRouter);