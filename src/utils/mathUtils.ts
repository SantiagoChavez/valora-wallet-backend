/**
 * Trunca un número a 8 decimales de forma segura y simétrica.
 *
 * Usa el signo del valor para aplicar el epsilon en la dirección
 * correcta (hacia cero) y evita overflow convirtiendo a string para
 * montos que excedan el rango seguro de operación con 1e8.
 *
 * Comportamiento en negativos: trunca hacia cero (igual que positivos).
 * Ejemplo: truncateTo8Decimals(-20.123456789) === -20.12345678
 */
export function truncateTo8Decimals(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`truncateTo8Decimals: valor no finito recibido (${value})`);
  }

  // Para valores que pueden causar overflow al multiplicar por 1e8,
  // usamos la representación string como fuente de verdad.
  // Number.MAX_SAFE_INTEGER / 1e8 ≈ 90_071_992.54 → usamos 90_000_000 como límite seguro
  if (Math.abs(value) >= 90_000_000) {
    const valueString = value.toString();
    const parts = valueString.split(".");
    const intPart = parts[0];
    const decPart = parts[1] || "";
    const truncatedDec = decPart.slice(0, 8).padEnd(8, "0");
    return parseFloat(`${intPart}.${truncatedDec}`);
  }

  // FIX: El epsilon siempre se suma en valor absoluto, luego se aplica el signo.
  // Esto garantiza truncar hacia cero (no hacia -∞) en negativos.
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  return sign * Math.trunc((abs + 1e-10) * 1e8) / 1e8;
}
