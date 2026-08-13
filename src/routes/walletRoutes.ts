import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { validateSchema } from "../middlewares/validateSchema.js";
import { updateAliasSchema } from "../schemas/walletSchema.js";
import { updateAliasController } from "../controllers/walletController.js";

export const walletRouter = Router();

walletRouter.put(
    "/alias",
    authMiddleware,
    validateSchema(updateAliasSchema),
    updateAliasController
);
