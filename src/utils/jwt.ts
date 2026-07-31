import jwt from "jsonwebtoken";

export interface JwtPayload {
  userId: string;
  email: string;
}

/**
 * Obtiene y valida la clave secreta para firmar y verificar tokens JWT.
 * @returns La clave secreta de JWT como un string garantizado.
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("La variable de entorno JWT_SECRET no está configurada.");
  }
  return secret;
}

/**
 * Genera un token JWT firmado con validez de 24 horas.
 * @param payload - Datos del usuario a incluir en el token.
 * @returns El token JWT firmado.
 */
export function generateToken(payload: JwtPayload): string {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, { expiresIn: "24h" });
}

/**
 * Verifica y decodifica un token JWT.
 * @param token - Token JWT a verificar.
 * @returns El payload decodificado si el token es válido.
 */
export function verifyToken(token: string): JwtPayload {
  const secret = getJwtSecret();
  return jwt.verify(token, secret) as JwtPayload;
}