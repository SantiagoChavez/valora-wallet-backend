import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../middlewares/authMiddleware.js";
import { initializeAndGetBalances } from "../services/balanceService.js";

/**
 * Controller to handle retrieving user balances.
 */
export async function getBalancesController(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
    ): Promise<void> {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ success: false, error: "AUTH_ERROR", message: "Usuario no autorizado." });
            return;
        }

        const balances = await initializeAndGetBalances(userId);

        // Map snake_case to camelCase for the frontend
        const mappedBalances = balances.map(b => ({
            id: b.id,
            walletId: b.wallet_id,
            currencyCode: b.currency_code,
            amount: parseFloat(b.amount),
            createdAt: b.created_at,
            updatedAt: b.updated_at
        }));

        res.status(200).json({
            success: true,
            data: mappedBalances
        });
    } catch (error: unknown) {
        next(error);
    }
}