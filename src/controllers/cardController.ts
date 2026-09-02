import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../middlewares/authMiddleware.js";
import { findUserById } from "../models/userModel.js";
import { findWalletByUserId } from "../models/walletModel.js";
import {
  createCard,
  findCardsByWalletId,
  findCardByIdAndWalletId,
  countCardsByWalletId,
  toggleFreezeCard,
  deleteCard,
  toCardResponse,
} from "../models/cardModel.js";

const MAX_CARDS_PER_WALLET = 5;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

/**
 * Obtiene la lista de todas las tarjetas asociadas a la billetera del usuario autenticado.
 */
export async function getCardsController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: "UnauthorizedError", message: "Token no proporcionado." });
      return;
    }

    const wallet = await findWalletByUserId(userId);
    if (!wallet) {
      res.status(404).json({ success: false, error: "NotFoundError", message: "Billetera no encontrada." });
      return;
    }

    const cards = await findCardsByWalletId(wallet.id);

    res.status(200).json({
      success: true,
      data: {
        cards: cards.map((card) => toCardResponse(card, true)),
      },
    });
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * Obtiene los detalles completos y no enmascarados de una tarjeta específica (para visualización/copia).
 */
export async function getCardDetailsController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, error: "UnauthorizedError", message: "Token no proporcionado." });
      return;
    }

    if (!id || !isValidUuid(id)) {
      res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "El ID de tarjeta provisto no es válido." });
      return;
    }

    const wallet = await findWalletByUserId(userId);
    if (!wallet) {
      res.status(404).json({ success: false, error: "NotFoundError", message: "Billetera no encontrada." });
      return;
    }

    const card = await findCardByIdAndWalletId(id, wallet.id);
    if (!card) {
      res.status(404).json({ success: false, error: "NotFoundError", message: "Tarjeta no encontrada." });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        card: toCardResponse(card, false),
      },
    });
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * Emite una nueva tarjeta virtual o física vinculada a la billetera.
 */
export async function createCardController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: "UnauthorizedError", message: "Token no proporcionado." });
      return;
    }

    const user = await findUserById(userId);
    if (!user) {
      res.status(404).json({ success: false, error: "NotFoundError", message: "Usuario no encontrado." });
      return;
    }

    const wallet = await findWalletByUserId(userId);
    if (!wallet) {
      res.status(404).json({ success: false, error: "NotFoundError", message: "Billetera no encontrada." });
      return;
    }

    const currentCardCount = await countCardsByWalletId(wallet.id);
    if (currentCardCount >= MAX_CARDS_PER_WALLET) {
      res.status(400).json({
        success: false,
        error: "CardLimitReachedError",
        message: `Alcanzaste el límite máximo de ${MAX_CARDS_PER_WALLET} tarjetas por cuenta.`,
      });
      return;
    }

    const { label, brand, cardType } = req.body;
    const holderName = `${user.first_name} ${user.last_name}`.trim().toUpperCase() || "USUARIO VALORA";

    const newCard = await createCard(wallet.id, holderName, label, brand, cardType);

    res.status(201).json({
      success: true,
      message: "Tarjeta emitida correctamente.",
      data: {
        card: toCardResponse(newCard, false),
      },
    });
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * Alterna el estado de congelamiento (bloqueo preventivo) de una tarjeta.
 */
export async function toggleFreezeCardController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, error: "UnauthorizedError", message: "Token no proporcionado." });
      return;
    }

    if (!id || !isValidUuid(id)) {
      res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "El ID de tarjeta provisto no es válido." });
      return;
    }

    const wallet = await findWalletByUserId(userId);
    if (!wallet) {
      res.status(404).json({ success: false, error: "NotFoundError", message: "Billetera no encontrada." });
      return;
    }

    const updatedCard = await toggleFreezeCard(id, wallet.id);
    if (!updatedCard) {
      res.status(404).json({ success: false, error: "NotFoundError", message: "Tarjeta no encontrada." });
      return;
    }

    res.status(200).json({
      success: true,
      message: updatedCard.is_frozen ? "Tarjeta congelada temporalmente." : "Tarjeta reactivada con éxito.",
      data: {
        card: toCardResponse(updatedCard, true),
      },
    });
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * Elimina o da de baja definitivamente una tarjeta.
 */
export async function deleteCardController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, error: "UnauthorizedError", message: "Token no proporcionado." });
      return;
    }

    if (!id || !isValidUuid(id)) {
      res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "El ID de tarjeta provisto no es válido." });
      return;
    }

    const wallet = await findWalletByUserId(userId);
    if (!wallet) {
      res.status(404).json({ success: false, error: "NotFoundError", message: "Billetera no encontrada." });
      return;
    }

    const deleted = await deleteCard(id, wallet.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: "NotFoundError", message: "Tarjeta no encontrada." });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Tarjeta eliminada correctamente.",
    });
  } catch (error: unknown) {
    next(error);
  }
}
