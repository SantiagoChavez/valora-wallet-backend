import type { Request, Response, NextFunction } from "express";
import type { ZodTypeAny } from "zod";
import { ZodError } from "zod";

interface ValidateSchemaOptions {
    errorCode?: string;
    includeIssues?: boolean;
}

declare global {
    namespace Express {
        interface Request {
            validatedQuery?: Record<string, any>;
        }
    }
}

/**
 * Middleware genérico para validar peticiones mediante esquemas de Zod.
 * Usa un contrato de error consistente para facilitar el consumo del frontend,
 * el debugging y las pruebas.
 */
export const validateSchema =
    (schema: ZodTypeAny, options: ValidateSchemaOptions = {}, target: "body" | "query" = "body") =>
        (req: Request, res: Response, next: NextFunction): void => {
            try {
                if (target === "query") {
                    req.validatedQuery = schema.parse(req.query) as Record<string, any>;
                } else {
                    req.body = schema.parse(req.body);
                }
                next();
            } catch (error) {
                if (error instanceof ZodError) {
                    const errorMessages = error.issues.map((issue) => issue.message);
                    const errorCode = options.errorCode ?? "VALIDATION_ERROR";
                    const includeIssues = options.includeIssues ?? true;

                    const responseBody: Record<string, unknown> = {
                        success: false,
                        error: errorCode,
                        message: errorMessages[0] || "Datos de solicitud no válidos.",
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