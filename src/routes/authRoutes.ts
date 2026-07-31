import { Router } from "express";
import {
  registerController,
  loginController,
  meController,
} from "../controllers/authController";
import { authMiddleware } from "../middlewares/authMiddleware";

export const authRouter = Router();

authRouter.post("/register", registerController);
authRouter.post("/login", loginController);
authRouter.get("/me", authMiddleware, meController);
