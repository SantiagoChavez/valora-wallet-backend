import { z } from "zod";

export const createCardSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "La etiqueta de la tarjeta no puede estar vacía.")
    .max(50, "La etiqueta no puede tener más de 50 caracteres.")
    .optional()
    .default("Tarjeta Principal"),
  brand: z
    .enum(["VALORA PLATINUM", "VALORA BLACK", "VALORA GOLD"], {
      error: "La marca seleccionada no es válida.",
    })
    .optional()
    .default("VALORA PLATINUM"),
  cardType: z
    .enum(["VIRTUAL", "PHYSICAL"], {
      error: "El tipo de tarjeta debe ser VIRTUAL o PHYSICAL.",
    })
    .optional()
    .default("VIRTUAL"),
});
