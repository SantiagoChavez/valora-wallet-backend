import { Router } from "express";
import {
  registerController,
  loginController,
  meController,
} from "../controllers/authController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { validateSchema } from "../middlewares/validateSchema";
import { registerSchema, loginSchema } from "../schemas/authSchema";

export const authRouter = Router();

authRouter.post("/register", validateSchema(registerSchema), registerController);
authRouter.post("/login", validateSchema(loginSchema), loginController);
authRouter.get("/me", authMiddleware, meController);