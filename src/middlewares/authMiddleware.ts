import type { Request, Response, NextFunction } from "express";
import { verifyToken, type JwtPayload } from "../utils/jwt";

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

/**
 * Middleware para validar el token JWT en las peticiones que requieren autenticación.
 */
export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      success: false,
      error: "UnauthorizedError",
      message: "Acceso no autorizado. Token no proporcionado."
    });
    return;
  }

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || !/^Bearer$/i.test(parts[0])) {
    res.status(401).json({
      success: false,
      error: "UnauthorizedError",
      message: "Formato de token inválido. Debe ser 'Bearer <token>'."
    });
    return;
  }

  const token = parts[1];

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: "UnauthorizedError",
      message: "Token inválido o expirado."
    });
  }
}