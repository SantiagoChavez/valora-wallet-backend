import type { Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { generateToken } from "../utils/jwt.js";
import {
  createUser,
  findUserByEmail,
  findUserById,
  setPasswordResetToken,
  findUserByValidResetToken,
  resetPasswordAndClearToken,
  type User,
} from "../models/userModel.js";
import { createWallet, findWalletByUserId } from "../models/walletModel.js";
import { createOrUpdateBalance, findBalancesByWalletId } from "../models/balanceModel.js";
import type { AuthenticatedRequest } from "../middlewares/authMiddleware.js";
import { pool } from "../database/db.js";
import { enviarEmailConfirmacion } from "../services/sesService.js";

const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutos
const PASSWORD_RESET_GENERIC_MESSAGE =
  "Si el correo está registrado, vas a recibir instrucciones para restablecer tu contraseña.";

export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  phone?: string | null;
}

/**
 * Formatea una fecha de nacimiento (Date, string, null o undefined) a formato DD/MM/YYYY de forma segura contra zonas horarias.
 */
function formatDate(dateInput: Date | string | null | undefined): string | null {
  if (!dateInput) return null;
  if (typeof dateInput === "string") {
    // Si ya es un formato de fecha limpio DD/MM/YYYY, lo retornamos directo
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateInput)) {
      return dateInput;
    }
    // Si es YYYY-MM-DD (retornado por pg), lo convertimos a DD/MM/YYYY
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      const parts = dateInput.split("-");
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const parsedDate = new Date(dateInput);
    if (isNaN(parsedDate.getTime())) {
      return dateInput;
    }
    const year = parsedDate.getUTCFullYear();
    const month = String(parsedDate.getUTCMonth() + 1).padStart(2, "0");
    const day = String(parsedDate.getUTCDate()).padStart(2, "0");
    return `${day}/${month}/${year}`;
  }

  // Si es un objeto Date de JS, usamos getters locales para respetar la fecha exacta de creación
  const year = dateInput.getFullYear();
  const month = String(dateInput.getMonth() + 1).padStart(2, "0");
  const day = String(dateInput.getDate()).padStart(2, "0");
  return `${day}/${month}/${year}`;
}

/**
 * Mapea un usuario de la base de datos al formato de respuesta seguro (DRY/camelCase)
 */
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
 * Controlador para el registro de nuevos usuarios.
 */
export async function registerController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password, firstName, lastName, dateOfBirth, phone } = req.body;

    // Verificar si el usuario ya existe
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      res.status(400).json({
        success: false,
        error: "DuplicateEmailError",
        message: "El correo electrónico ya se encuentra registrado"
      });
      return;
    }

    // Hashear contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Obtener un cliente de la pool para la transacción atómica
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Crear el usuario
      const user = await createUser(email, passwordHash, firstName, lastName, dateOfBirth, phone, client);

      // Crear su billetera asociada
      const wallet = await createWallet(user.id, client);

      // Asignar saldo inicial de USD
      await createOrUpdateBalance(wallet.id, "USD", "0.00000000", client);

      await client.query("COMMIT");

      // Generar token JWT
      const token = generateToken({ userId: user.id, email: user.email });

      res.status(201).json({
        token,
        user: toUserResponse(user),
        walletId: wallet.id
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Error al ejecutar ROLLBACK en la transacción:", rollbackError);
      }
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

/**
 * Controlador para el inicio de sesión de usuarios existentes.
 */
export async function loginController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = req.body;

    // Buscar usuario por correo electrónico
    const user = await findUserByEmail(email);
    if (!user) {
      res.status(401).json({
        success: false,
        error: "UnauthorizedError",
        message: "Credenciales incorrectas."
      });
      return;
    }

    // Comparar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        error: "UnauthorizedError",
        message: "Credenciales incorrectas."
      });
      return;
    }

    // Obtener la billetera del usuario
    const wallet = await findWalletByUserId(user.id);
    if (!wallet) {
      res.status(404).json({
        success: false,
        error: "NotFoundError",
        message: "La billetera asociada al usuario no fue encontrada."
      });
      return;
    }

    // Generar token JWT
    const token = generateToken({ userId: user.id, email: user.email });

    res.status(200).json({
      token,
      user: toUserResponse(user),
      walletId: wallet.id
    });
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * Obtiene el perfil del usuario autenticado actual.
 */
export async function meController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: "UnauthorizedError",
        message: "Acceso no autorizado. Token no proporcionado."
      });
      return;
    }

    // Buscar usuario
    const user = await findUserById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        error: "NotFoundError",
        message: "Usuario no encontrado."
      });
      return;
    }

    // Buscar billetera
    const wallet = await findWalletByUserId(user.id);
    if (!wallet) {
      res.status(404).json({
        success: false,
        error: "NotFoundError",
        message: "Billetera no encontrada para el usuario."
      });
      return;
    }

    // Obtener los saldos de la billetera
    const balances = await findBalancesByWalletId(wallet.id);

    res.status(200).json({
      user: toUserResponse(user),
      walletId: wallet.id,
      balances
    });
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * Controlador para cerrar la sesión del usuario.
 * JWT es stateless — el logout real ocurre en el cliente al descartar el token.
 * Este endpoint confirma la acción y le indica al Frontend que limpie su estado local.
 */
export function logoutController(
  _req: AuthenticatedRequest,
  res: Response,
): void {
  res.status(200).json({
    success: true,
    message: "Sesión cerrada correctamente. Por favor, descarta el token en el cliente."
  });
}

/**
 * Controlador para solicitar la recuperación de contraseña.
 * Siempre responde con el mismo mensaje genérico, exista o no el email, para no revelar
 * qué correos están registrados. Si el fallo es al enviar el email, tampoco se filtra al cliente.
 * El envío del email no se espera (fire-and-forget): es la parte más lenta del flujo (red hacia
 * SES) y esperarla permitiría distinguir por timing si el email existe o no, aunque la respuesta
 * sea idéntica en ambos casos.
 */
export async function forgotPasswordController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email } = req.body;

    const user = await findUserByEmail(email);
    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

      await setPasswordResetToken(user.id, tokenHash, expiresAt);

      const frontendUrl = (process.env.FRONTEND_URL ?? "").replace(/\/$/, "");
      const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

      enviarEmailConfirmacion({
        destinatario: user.email,
        asunto: "Recuperación de contraseña - Valora Wallet",
        cuerpoHtml: `<p>Recibimos una solicitud para restablecer tu contraseña en Valora Wallet.</p><p><a href="${resetLink}">Hacé clic acá para elegir una nueva contraseña</a></p><p>Este link expira en 30 minutos. Si no fuiste vos quien lo solicitó, podés ignorar este mensaje.</p>`,
      }).catch((emailError: unknown) => {
        console.error("Fallo al enviar el email de recuperación de contraseña:", emailError);
      });
    }

    res.status(200).json({ message: PASSWORD_RESET_GENERIC_MESSAGE });
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * Controlador para restablecer la contraseña usando un token válido y no expirado.
 */
export async function resetPasswordController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { token, password } = req.body;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await findUserByValidResetToken(tokenHash);
    if (!user) {
      res.status(400).json({
        success: false,
        error: "InvalidTokenError",
        message: "El link de recuperación no es válido o expiró."
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await resetPasswordAndClearToken(user.id, passwordHash);

    res.status(200).json({ message: "Tu contraseña fue actualizada correctamente." });
  } catch (error: unknown) {
    next(error);
  }
}
