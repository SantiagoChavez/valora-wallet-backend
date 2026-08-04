import type { Request, Response, NextFunction } from "express";
import type { ZodTypeAny } from "zod";
import { ZodError } from "zod";

/**
 * Middleware genérico para validar peticiones mediante esquemas de Zod
 */
export const validateSchema =
    (schema: ZodTypeAny) =>
        (req: Request, res: Response, next: NextFunction): void => {
            try {
                req.body = schema.parse(req.body);
                next();
            } catch (error) {
                if (error instanceof ZodError) {
                    const errorMessages = error.issues.map((issue) => issue.message);

                    res.status(400).json({
                        success: false,
                        error: "ValidationError",
                        message: errorMessages[0] || "Datos de solicitud no válidos",
                        issues: errorMessages,
                    });
                    return;
                }

                next(error);
            }
        };