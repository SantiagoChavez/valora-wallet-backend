import { z } from "zod";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

// Regex estándar de email para evitar métodos con firmas deprecadas
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Esquema de validación para el registro de usuarios
 */
export const registerSchema = z.object({
    email: z
        .string({ message: "El correo electrónico es requerido." })
        .trim()
        .toLowerCase()
        .refine((val) => emailRegex.test(val), {
            message: "El correo electrónico provisto no tiene un formato válido.",
        }),
    password: z
        .string({ message: "La contraseña es requerida." })
        .trim()
        .min(6, "La contraseña debe tener al menos 6 caracteres."),
    firstName: z
        .string({ message: "El nombre es requerido." })
        .trim()
        .min(2, "El nombre debe tener al menos 2 caracteres."),
    lastName: z
        .string({ message: "El apellido es requerido." })
        .trim()
        .min(2, "El apellido debe tener al menos 2 caracteres."),
    dateOfBirth: z
        .string({ message: "La fecha de nacimiento es requerida." })
        .trim()
        .refine((val) => {
            // Validar formato YYYY-MM-DD
            const parts = val.split("-");
            if (parts.length !== 3) return false;
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // 0-indexed en JS Date
            const day = parseInt(parts[2], 10);
            
            const birthDateUTC = new Date(Date.UTC(year, month, day));
            if (isNaN(birthDateUTC.getTime())) return false;

            // Evitar desbordamientos de fecha del calendario (ej. 30 de febrero)
            if (
                birthDateUTC.getUTCFullYear() !== year ||
                birthDateUTC.getUTCMonth() !== month ||
                birthDateUTC.getUTCDate() !== day
            ) {
                return false;
            }

            const today = new Date();
            const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
            const cutoffUTC = new Date(Date.UTC(todayUTC.getUTCFullYear() - 18, todayUTC.getUTCMonth(), todayUTC.getUTCDate()));

            return birthDateUTC <= cutoffUTC;
        }, {
            message: "Debes ser mayor de 18 años para registrarte.",
        }),
    phone: z
        .string({ message: "El número de teléfono es requerido." })
        .trim()
        .transform((val, ctx) => {
            const defaultCountry: CountryCode = "AR";
            const phoneNumber = val.startsWith("+")
                ? parsePhoneNumberFromString(val)
                : parsePhoneNumberFromString(val, defaultCountry);

            if (!phoneNumber || !phoneNumber.isValid()) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "El número de teléfono provisto no es válido.",
                });
                return z.NEVER;
            }
            return phoneNumber.number; // E.164 format guaranteed
        }),
});

/**
 * Esquema de validación para el inicio de sesión
 */
export const loginSchema = z.object({
    email: z
        .string({ message: "El correo electrónico es requerido." })
        .trim()
        .toLowerCase()
        .refine((val) => emailRegex.test(val), {
            message: "El correo electrónico provisto no tiene un formato válido.",
        }),
    password: z
        .string({ message: "La contraseña es requerida." })
        .trim()
        .min(1, "La contraseña no puede estar vacía."),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;