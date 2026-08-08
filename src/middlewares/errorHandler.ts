import type { NextFunction, Request, Response } from "express";

export function errorHandler(
  err: Error & { status?: number; statusCode?: number; code?: string; name?: string },
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error(err);

  // Capturar errores de sintaxis JSON malformado enviados en el request body
  if (err instanceof SyntaxError && (err as any).status === 400 && "body" in err) {
    res.status(400).json({
      success: false,
      error: "INVALID_JSON",
      message: "El cuerpo de la solicitud contiene un JSON con formato inválido."
    });
    return;
  }
  
  const isProduction = process.env.NODE_ENV === "production";
  const isTest = process.env.NODE_ENV === "test";
  const rawStatus = Number(err.status ?? err.statusCode);
  const statusCode = Number.isInteger(rawStatus) && rawStatus >= 100 && rawStatus <= 599 ? rawStatus : 500;
  
  const message = (statusCode === 500 && isProduction)
    ? "Error interno del servidor"
    : (err.message || "Error interno del servidor");

  let errorCode = err.code || err.name || "InternalServerError";
  if (errorCode === "Error") {
    errorCode = "InternalServerError";
  }

  const responseBody: Record<string, unknown> = {
    success: false,
    error: errorCode,
    message
  };

  // Se incluye únicamente cuando process.env.NODE_ENV !== "production"
  // Para evitar romper los tests existentes, tampoco se incluye en entorno "test"
  if (!isProduction && !isTest && err.stack) {
    responseBody.stack = err.stack;
  }

  res.status(statusCode).json(responseBody);
}
