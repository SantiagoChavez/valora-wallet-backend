import { z } from "zod";

export const updateAliasSchema = z.object({
    alias: z
        .string({ message: "El alias es requerido." })
        .trim()
        .min(6, "El alias debe tener al menos 6 caracteres.")
        .max(100, "El alias es demasiado largo.")
        .regex(/^[a-z0-9.]+$/, "El alias solo puede contener letras minúsculas, números y puntos."),
});
