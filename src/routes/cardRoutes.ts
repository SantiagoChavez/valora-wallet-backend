import { Router } from "express";
import {
  getCardsController,
  getCardDetailsController,
  createCardController,
  toggleFreezeCardController,
  deleteCardController,
} from "../controllers/cardController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { requireCompleteProfile } from "../middlewares/requireCompleteProfile.js";
import { validateSchema } from "../middlewares/validateSchema.js";
import { createCardSchema } from "../schemas/cardSchema.js";

export const cardRouter = Router();

// Todas las rutas de tarjetas requieren autenticación
cardRouter.use(authMiddleware);

// Listar todas las tarjetas del usuario
cardRouter.get("/", getCardsController);

// Obtener detalles completos (número y CVV desocultos) de una tarjeta puntual
cardRouter.get("/:id/details", getCardDetailsController);

// Emisión de nueva tarjeta (exige perfil completo verificado)
cardRouter.post(
  "/",
  requireCompleteProfile,
  validateSchema(createCardSchema),
  createCardController
);

// Congelar / Descongelar tarjeta
cardRouter.patch("/:id/freeze", toggleFreezeCardController);

// Eliminar / Dar de baja tarjeta
cardRouter.delete("/:id", deleteCardController);
