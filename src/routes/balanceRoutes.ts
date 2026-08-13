import { Router } from "express";
import { getBalancesController } from "../controllers/balanceController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

export const balanceRouter = Router();

balanceRouter.get("/", authMiddleware, getBalancesController);