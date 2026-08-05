import type { Request, Response, NextFunction } from "express";
import type { ZodTypeAny } from "zod";
import { ZodError } from "zod";

interface ValidateSchemaOptions {
    errorCode?: string;
    includeIssues?: boolean;
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
                    const parsedQuery = schema.parse(req.query);
                    for (const key in req.query) {
                        if (Object.prototype.hasOwnProperty.call(req.query, key)) {
                            delete req.query[key];
                        }
                    }
                    Object.assign(req.query, parsedQuery);
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