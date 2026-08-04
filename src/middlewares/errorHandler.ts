import type { NextFunction, Request, Response } from "express";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error(err);
  const isProduction = process.env.NODE_ENV === "production";
  const message = (err instanceof Error && !isProduction) ? err.message : "Error interno del servidor";
  res.status(500).json({
    success: false,
    error: "InternalServerError",
    message
  });
}
