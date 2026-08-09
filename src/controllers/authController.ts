import type { Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";
import { generateToken } from "../utils/jwt.js";
import { createUser, findUserByEmail, findUserById, type User } from "../models/userModel.js";
import { createWallet, findWalletByUserId } from "../models/walletModel.js";
import { createOrUpdateBalance, findBalancesByWalletId } from "../models/balanceModel.js";
import type { AuthenticatedRequest } from "../middlewares/authMiddleware.js";
import { pool } from "../database/db.js";

export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  phone?: string | null;
}

function formatDate(dateInput: Date | string | null | undefined): string | null {
  if (!dateInput) return null;
  if (typeof dateInput === "string") {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateInput)) return dateInput;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      const parts = dateInput.split("-");
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const parsedDate = new Date(dateInput);
    if (isNaN(parsedDate.getTime())) return dateInput;
    
    const year = parsedDate.getUTCFullYear();
    const month = String(parsedDate.getUTCMonth() + 1).padStart(2, "0");
    const day = String(parsedDate.getUTCDate()).padStart(2, "0");
    return `${day}/${month}/${year}`;
  }

  const year = dateInput.getFullYear();
  const month = String(dateInput.getMonth() + 1).padStart(2, "0");
  const day = String(dateInput.getDate()).padStart(2, "0");
  return `${day}/${month}/${year}`;
}

export function toUserResponse(user: User, includePII = true): UserResponse {
  const response: UserResponse = {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
  };

  if (includePII) {
    response.dateOfBirth = formatDate(user.date_of_birth);
    response.phone = user.phone || null;
  }

  return response;
}

/**
 * HELPER DRY: Genera la respuesta estándar de sesión (Token + Perfil + Wallet)
 */
function sendAuthSuccess(res: Response, statusCode: number, user: User, walletId: string) {
  const token = generateToken({ userId: user.id, email: user.email });
  res.status(statusCode).json({
    success: true,
    data: {
      token,
      user: toUserResponse(user),
      walletId
    }
  });
}

export async function registerController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password, firstName, lastName, dateOfBirth, phone } = req.body;

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      res.status(400).json({
        success: false,
        error: "DuplicateEmailError",
        message: "El correo electrónico ya se encuentra registrado"
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const user = await createUser(email, passwordHash, firstName, lastName, dateOfBirth, phone, client);
      const wallet = await createWallet(user.id, client);
      await createOrUpdateBalance(wallet.id, "USD", "0.00000000", client);
      
      await client.query("COMMIT");
      
      sendAuthSuccess(res, 201, user, wallet.id);
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch (e) { /* Ignorar error de rollback */ }
      throw error;
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      res.status(400).json({
        success: false,
        error: "DuplicateEmailError",
        message: "El correo electrónico ya se encuentra registrado"
      });
      return;
    }
    next(error);
  }
}

export async function loginController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = req.body;

    const user = await findUserByEmail(email);
    if (!user) {
      res.status(401).json({ success: false, error: "UnauthorizedError", message: "Credenciales incorrectas." });
      return;
    }

    if (!user.password_hash) {
      res.status(401).json({
        success: false,
        error: "UnauthorizedError",
        message: "Esta cuenta utiliza inicio de sesión con Google. Por favor, usa el botón de Google."
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      res.status(401).json({ success: false, error: "UnauthorizedError", message: "Credenciales incorrectas." });
      return;
    }

    const wallet = await findWalletByUserId(user.id);
    if (!wallet) {
      res.status(404).json({ success: false, error: "NotFoundError", message: "Billetera no encontrada." });
      return;
    }

    sendAuthSuccess(res, 200, user, wallet.id);
  } catch (error: unknown) {
    next(error);
  }
}

export async function meController(
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

    const wallet = await findWalletByUserId(user.id);
    if (!wallet) {
      res.status(404).json({ success: false, error: "NotFoundError", message: "Billetera no encontrada." });
      return;
    }

    const balances = await findBalancesByWalletId(wallet.id);

    res.status(200).json({
      success: true,
      data: {
        user: toUserResponse(user),
        walletId: wallet.id,
        balances
      }
    });
  } catch (error: unknown) {
    next(error);
  }
}

export function logoutController(_req: AuthenticatedRequest, res: Response): void {
  res.status(200).json({
    success: true,
    message: "Sesión cerrada correctamente. Por favor, descarta el token en el cliente."
  });
}

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function googleLoginController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { idToken } = req.body;

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(401).json({ success: false, error: "UnauthorizedError", message: "Token inválido." });
      return;
    }

    const { email, given_name, family_name } = payload;
    let user = await findUserByEmail(email);
    let walletId: string;

    if (user) {
      if (user.password_hash !== null) {
        res.status(400).json({
          success: false,
          error: "DuplicateEmailError",
          message: "El correo electrónico ya se encuentra registrado"
        });
        return;
      }
      const wallet = await findWalletByUserId(user.id);
      if (!wallet) throw new Error("El usuario de Google existe pero no tiene billetera.");
      walletId = wallet.id;
    } else {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        user = await createUser(email, null, given_name || "Usuario", family_name || "", null, null, client);
        const newWallet = await createWallet(user.id, client);
        await createOrUpdateBalance(newWallet.id, "USD", "0.00000000", client);
        await client.query("COMMIT");
        walletId = newWallet.id;
      } catch (error) {
        try { await client.query("ROLLBACK"); } catch (e) { /* Ignorar */ }
        
        // Manejo de condición de carrera para Google Sign-in
        if (error && typeof error === "object" && "code" in error && error.code === "23505") {
          // El usuario fue creado concurrentemente. Lo recuperamos en lugar de fallar.
          user = await findUserByEmail(email);
          if (user) {
             const existingWallet = await findWalletByUserId(user.id);
             walletId = existingWallet?.id || "";
          } else {
             throw error; 
          }
        } else {
          throw error;
        }
      } finally {
        client.release();
      }
    }

    sendAuthSuccess(res, 200, user, walletId);
  } catch (error: unknown) {
    next(error);
  }
}
