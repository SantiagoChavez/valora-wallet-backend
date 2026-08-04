import type { Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import { generateToken } from "../utils/jwt";
import { createUser, findUserByEmail, findUserById } from "../models/userModel";
import { createWallet, findWalletByUserId } from "../models/walletModel";
import { createOrUpdateBalance, findBalancesByWalletId } from "../models/balanceModel";
import type { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { pool } from "../database/db";

/**
 * Controlador para el registro de nuevos usuarios.
 */
export async function registerController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password, firstName, lastName } = req.body;

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
      const user = await createUser(email, passwordHash, firstName, lastName, client);

      // Crear su billetera asociada
      const wallet = await createWallet(user.id, client);

      // Asignar saldo inicial de USD
      await createOrUpdateBalance(wallet.id, "USD", "0.00000000", client);

      await client.query("COMMIT");

      // Generar token JWT
      const token = generateToken({ userId: user.id, email: user.email });

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name
        },
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
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      },
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
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      },
      walletId: wallet.id,
      balances
    });
  } catch (error: unknown) {
    next(error);
  }
}
