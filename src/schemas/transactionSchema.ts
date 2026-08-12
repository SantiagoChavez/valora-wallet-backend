import { z } from "zod";

// -----------------------------------------------------------------------------
// 1. CONSTANTES BASE (Single Source of Truth & Blindaje Fintech)
// -----------------------------------------------------------------------------

// Bloquea espacios, etiquetas HTML (<, >), comillas y caracteres raros (Anti-XSS).
const validIdentifierRegex = /^[a-zA-Z0-9.@_+-]+$/;

// Validación estricta para monedas (Ej. ARS, USD). Previene DoS por strings gigantes.
const currencyBaseSchema = z
  .string({ message: "La moneda es obligatoria." })
  .trim()
  .length(3, "La moneda debe tener exactamente 3 caracteres (ej. ARS, USD).")
  .toUpperCase();

// Validación estricta para dinero. Previene desbordamiento DB, números falsos y robo fraccional.
const amountBaseSchema = z
  .number({ message: "El monto debe ser numérico." })
  .positive("El monto debe ser un número mayor a cero.")
  .max(1000000000, "El monto excede el límite operativo permitido por transacción.")
  .refine((val) => {
    // FIX: Aumentamos el límite de validación a 8 decimales para hacer match con PostgreSQL (NUMERIC 18,8)
    // y con el truncamiento estricto del servicio interno.
    return Math.trunc(val * 1e8) / 1e8 === val;
  }, "El monto no puede tener más de 8 decimales.");

// -----------------------------------------------------------------------------
// 2. ESQUEMAS DE ENDPOINTS (Limpios, Cortos y Seguros)
// -----------------------------------------------------------------------------

export const depositSchema = z.object({
  currency: currencyBaseSchema,
  amount: amountBaseSchema,
});

export const quoteSchema = z.object({
  fromCurrency: currencyBaseSchema,
  toCurrency: currencyBaseSchema,
  amount: amountBaseSchema,
});

export const exchangeSchema = z.object({
  fromCurrency: currencyBaseSchema,
  toCurrency: currencyBaseSchema,
  amount: amountBaseSchema,
});

export const transferSchema = z.object({
  currency: currencyBaseSchema,
  amount: amountBaseSchema,
  destination: z
    .string({ message: "El destino es obligatorio." })
    .trim()
    .max(100, "El destino es demasiado largo (máx 100 caracteres).")
    .regex(validIdentifierRegex, "El destino contiene caracteres no permitidos o está vacío."), // Blindaje Anti-XSS
});

export const resolveUserSchema = z.object({
  identifier: z
    .string({ message: "El identificador es obligatorio." })
    .trim()
    .max(100, "El identificador es demasiado largo (máx 100 caracteres).")
    .regex(validIdentifierRegex, "El identificador contiene caracteres no permitidos o está vacío."), // Blindaje Anti-XSS
});

// -----------------------------------------------------------------------------
// 3. ESQUEMAS DE BÚSQUEDA / PAGINACIÓN
// -----------------------------------------------------------------------------

export const getTransactionsQuerySchema = z.object({
  limit: z
    .preprocess((val) => {
      if (Array.isArray(val)) val = val[0];
      if (val === undefined || val === null || val === "") return undefined;
      if (typeof val === "string") {
        const parsed = parseInt(val, 10);
        return isNaN(parsed) ? val : parsed;
      }
      return val;
    }, z.number({ message: "El límite debe ser un número entero." })
       .int("El límite debe ser un número entero.")
       .min(1, "El límite mínimo es 1.")
       .max(100, "El límite máximo es 100.")
       .optional())
    .default(20),
  page: z
    .preprocess((val) => {
      if (Array.isArray(val)) val = val[0];
      if (val === undefined || val === null || val === "") return undefined;
      if (typeof val === "string") {
        const parsed = parseInt(val, 10);
        return isNaN(parsed) ? val : parsed;
      }
      return val;
    }, z.number({ message: "La página debe ser un número entero." })
       .int("La página debe ser un número entero.")
       .min(1, "La página mínima es 1.")
       .max(10000, "La página máxima permitida es 10000.") // Prevención Offset DoS
       .optional())
    .default(1),
  type: z
    .union([
      z.literal("BUY"),
      z.literal("SELL"),
      z.literal("EXCHANGE"),
      z.literal("DEPOSIT"),
      z.literal("TRANSFER_OUT"),
      z.literal("TRANSFER_IN"),
    ], {
      message: "El tipo de transacción no es válido.",
    })
    .optional(),
});

export type GetTransactionsQuery = z.infer<typeof getTransactionsQuerySchema>;
