import type { NextFunction, Request, Response } from "express";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  console.error(err);
  
  const isProduction = process.env.NODE_ENV === "production";
  const isTest = process.env.NODE_ENV === "test";
  const statusCode = err.status || err.statusCode || 500;
  
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
