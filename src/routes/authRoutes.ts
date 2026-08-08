import { Router } from "express";
import {
  registerController,
  loginController,
  meController,
  logoutController,
} from "../controllers/authController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { validateSchema } from "../middlewares/validateSchema.js";
import { registerSchema, loginSchema } from "../schemas/authSchema.js";

export const authRouter = Router();

authRouter.post("/register", validateSchema(registerSchema), registerController);
authRouter.post("/login", validateSchema(loginSchema), loginController);
authRouter.get("/me", authMiddleware, meController);
authRouter.post("/logout", authMiddleware, logoutController);