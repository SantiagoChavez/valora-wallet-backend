import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../middlewares/authMiddleware.js";
import { findWalletByUserId, updateWalletAlias } from "../models/walletModel.js";

export async function updateAliasController(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.user?.userId;
        const { alias } = req.body;

        if (!userId) {
            res.status(401).json({ success: false, error: "UnauthorizedError", message: "Token no proporcionado." });
            return;
        }

        const wallet = await findWalletByUserId(userId);
        if (!wallet) {
            res.status(404).json({ success: false, error: "NotFoundError", message: "Billetera no encontrada." });
            return;
        }

        const updatedWallet = await updateWalletAlias(wallet.id, alias);
        
        res.status(200).json({
            success: true,
            data: {
                wallet: {
                    id: updatedWallet?.id,
                    cvu: updatedWallet?.cvu,
                    alias: updatedWallet?.alias
                }
            },
            message: "Alias actualizado correctamente."
        });

    } catch (error: any) {
        if (error && error.code === "23505") {
            res.status(409).json({
                success: false,
                error: "DuplicateAliasError",
                message: "Este alias ya está en uso por otro usuario."
            });
            return;
        }
        next(error);
    }
}
