import type { Request, Response, NextFunction } from "express";
import type { ZodTypeAny } from "zod";
import { ZodError } from "zod";

/**
 * Middleware genérico para validar peticiones mediante esquemas de Zod
 */
export const validateSchema =
    (schema: ZodTypeAny, options?: { errorCode?: string; includeIssues?: boolean }) =>
        (req: Request, res: Response, next: NextFunction): void => {
            try {
                req.body = schema.parse(req.body);
                next();
            } catch (error) {
                if (error instanceof ZodError) {
                    const errorMessages = error.issues.map((issue) => issue.message);
                    const errorCode = options?.errorCode ?? "ValidationError";
                    const includeIssues = options?.includeIssues ?? true;

                    const responseBody: Record<string, unknown> = {
                        success: false,
                        error: errorCode,
                        message: errorMessages[0] || "Datos de solicitud no válidos",
                    };

                    if (includeIssues) {
                        responseBody.issues = errorMessages;
                    }

                    res.status(400).json(responseBody);
                    return;
                }

                next(error);
            }
        };