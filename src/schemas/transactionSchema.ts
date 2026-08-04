import { z } from "zod";

export const depositSchema = z.object({
  currency: z.string({ message: "La moneda es obligatoria." }).trim().min(1, "La moneda es obligatoria."),
  amount: z.number({ message: "El monto debe ser un número mayor a cero." }).positive("El monto debe ser un número mayor a cero."),
});

export const exchangeSchema = z.object({
  fromCurrency: z.string({ message: "La moneda de origen es obligatoria." }).trim().min(1, "La moneda de origen es obligatoria."),
  toCurrency: z.string({ message: "La moneda de destino es obligatoria." }).trim().min(1, "La moneda de destino es obligatoria."),
  amount: z.number({ message: "El monto debe ser un número mayor a cero." }).positive("El monto debe ser un número mayor a cero."),
});
