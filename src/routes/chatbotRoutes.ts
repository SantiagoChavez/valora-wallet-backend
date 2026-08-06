import { Router } from "express";
import { chatController } from "../controllers/chatbotController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

export const chatbotRouter = Router();

// Endpoint protegido para enviar mensajes al asistente
chatbotRouter.post("/message", authMiddleware, chatController);