import { Router } from "express";
import { authRouter } from "./authRoutes";
import { transactionRouter } from "./transactionRoutes";
import { balanceRouter } from "./balanceRoutes";

export const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.use("/auth", authRouter);
router.use("/transactions", transactionRouter);
router.use("/balances", balanceRouter);