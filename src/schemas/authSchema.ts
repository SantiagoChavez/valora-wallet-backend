import { z } from "zod";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { emailRegex } from "../utils/emailValidation.js";

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
    country: z.enum(["AR", "PE", "MX", "CO"]).default("AR"),
    du: z
        .string({ message: "El documento único es requerido." })
        .trim()
        .transform((val) => val.replace(/[\s.-]/g, "").toUpperCase()),
}).superRefine((data, ctx) => {
    const du = data.du;
    const country = data.country;
    let isValid = false;
    let expectedFormat = "";

    switch (country) {
        case "AR":
            isValid = /^\d{7,8}$/.test(du);
            expectedFormat = "7 u 8 dígitos numéricos";
            break;
        case "PE":
            isValid = /^\d{8}$/.test(du);
            expectedFormat = "8 dígitos numéricos";
            break;
        case "CO":
            isValid = /^\d{8,10}$/.test(du);
            expectedFormat = "8 a 10 dígitos numéricos";
            break;
        case "MX":
            isValid = /^[A-Z0-9]{10,18}$/.test(du);
            expectedFormat = "10 a 18 caracteres alfanuméricos";
            break;
        default:
            isValid = /^[A-Z0-9]{6,18}$/.test(du);
            expectedFormat = "6 a 18 caracteres alfanuméricos";
    }

    if (!isValid) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `El documento único para ${country} no es válido. Formato esperado: ${expectedFormat}.`,
            path: ["du"],
        });
    }
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

/**
 * Esquema de validación para solicitar la recuperación de contraseña
 */
export const forgotPasswordSchema = z.object({
    email: z
        .string({ message: "El correo electrónico es requerido." })
        .trim()
        .toLowerCase()
        .refine((val) => emailRegex.test(val), {
            message: "El correo electrónico provisto no tiene un formato válido.",
        }),
});

/**
 * Esquema de validación para restablecer la contraseña con un token
 */
export const resetPasswordSchema = z.object({
    token: z
        .string({ message: "El token es requerido." })
        .trim()
        .min(1, "El token es requerido."),
    password: z
        .string({ message: "La contraseña es requerida." })
        .trim()
        .min(6, "La contraseña debe tener al menos 6 caracteres."),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Esquema de validación para el inicio de sesión con Google
 */
export const googleLoginSchema = z.object({
    idToken: z
        .string({ message: "El idToken de Google es requerido." })
        .trim()
        .min(1, "El idToken no puede estar vacío."),
});

export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;
