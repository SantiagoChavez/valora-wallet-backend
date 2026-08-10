// Se usa la variante "max" (metadata completa) en vez del paquete base porque
// getType() necesita la metadata extendida para distinguir FIXED_LINE de MOBILE
// en la mayoría de los países LATAM — con la metadata reducida por defecto,
// getType() devuelve undefined para la mayoría de los números.
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";

export interface ValidarCelularResult {
  valido: boolean;
  esCelular: boolean;
  e164: string | null;
}

/**
 * Valida y normaliza un número de celular con libphonenumber-js, usando el país elegido
 * por el usuario como referencia (funciona tanto si el número ya viene con "+" como si no).
 * Rechaza explícitamente los números de línea fija (FIXED_LINE) — este campo es
 * específicamente para celular, pensando en una futura verificación por SMS/WhatsApp.
 * @param numero - Número tal como lo mandó el usuario (con o sin "+").
 * @param paisIso - Código ISO 3166-1 alpha-2 del país elegido (ej. "AR").
 * @returns Si es válido, si es celular, y el valor normalizado en E.164 (null si no es válido).
 */
export function validarCelular(numero: string, paisIso: string): ValidarCelularResult {
  const phoneNumber = parsePhoneNumberFromString(numero.trim(), paisIso as CountryCode);

  if (!phoneNumber || !phoneNumber.isValid()) {
    return { valido: false, esCelular: false, e164: null };
  }

  const tipo = phoneNumber.getType();
  // MOBILE y FIXED_LINE_OR_MOBILE (ambiguo, común en varios países LATAM) se aceptan;
  // FIXED_LINE se rechaza explícitamente porque el campo es para celular.
  const esCelular = tipo !== "FIXED_LINE";

  return {
    valido: esCelular,
    esCelular,
    e164: esCelular ? phoneNumber.number : null,
  };
}
