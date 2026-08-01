import type { NextFunction, Request, Response } from "express";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error(err);
  const message = err instanceof Error ? err.message : "Error interno del servidor";
  res.status(500).json({
    success: false,
    error: "InternalServerError",
    message
  });
}
