/**
 * Trunca un número a 8 decimales aplicando un epsilon sign-aware.
 *
 * - Para valores positivos se suma `1e-10` antes de truncar.
 * - Para valores negativos se resta `1e-10` antes de truncar.
 *
 * Esta lógica evita que números negativos se aproximen a cero y
 * garantiza consistencia entre capas del back-end.
 */
export function truncateTo8Decimals(value: number): number {
    return Math.trunc((value >= 0 ? value + 1e-10 : value - 1e-10) * 1e8) / 1e8;
}
