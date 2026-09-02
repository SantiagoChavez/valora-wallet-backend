import crypto from "crypto";

/**
 * Calcula el dígito de verificación usando el Algoritmo de Luhn (Módulo 10).
 */
function calculateLuhnCheckDigit(partialCardNumber: string): number {
  let sum = 0;
  let shouldDouble = true;

  // Recorremos de derecha a izquierda los dígitos ya conocidos
  for (let i = partialCardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(partialCardNumber.charAt(i), 10);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Genera un número de tarjeta de 16 dígitos válido según el algoritmo de Luhn.
 * Utiliza un prefijo BIN estándar fintech (por defecto 5412 para Mastercard / Valora).
 */
export function generateValidCardNumber(binPrefix = "5412"): string {
  // Necesitamos 16 dígitos en total: prefijo (4) + cuerpo aleatorio (11) + dígito verificador (1)
  const requiredRandomDigits = 16 - binPrefix.length - 1;
  let randomBody = "";

  for (let i = 0; i < requiredRandomDigits; i++) {
    randomBody += crypto.randomInt(0, 10).toString();
  }

  const partialNumber = `${binPrefix}${randomBody}`;
  const checkDigit = calculateLuhnCheckDigit(partialNumber);

  return `${partialNumber}${checkDigit}`;
}

/**
 * Genera un CVV de 3 dígitos numéricos seguros.
 */
export function generateCvv(): string {
  return String(crypto.randomInt(100, 1000));
}

/**
 * Genera fecha de vencimiento (mes y año en 2 dígitos) con vigencia configurada (default 3 años).
 */
export function generateExpiry(yearsAhead = 3): { month: string; year: string } {
  const now = new Date();
  const futureYear = now.getFullYear() + yearsAhead;
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = String(futureYear % 100).padStart(2, "0");

  return { month, year };
}
