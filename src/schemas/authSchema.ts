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
        .regex(/^\d{2}\/\d{2}\/\d{4}$/, {
            message: "La fecha de nacimiento debe tener el formato DD/MM/YYYY",
        })
        .refine((val) => {
            // Si el formato no coincide con el regex, dejamos que la validación .regex maneje el error
            if (!/^\d{2}\/\d{2}\/\d{4}$/.test(val)) return true;
            const parts = val.split("/");
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // 0-indexed en JS Date
            const year = parseInt(parts[2], 10);
            
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
        })
        .transform((val) => {
            // Transformar a YYYY-MM-DD para la base de datos
            const parts = val.split("/");
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
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