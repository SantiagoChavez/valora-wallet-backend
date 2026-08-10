export interface ExchangeRatePair {
    value: number;
}

export interface ExchangeRates {
    // Tasas base (relativas a USD)
    USD: number;
    EUR: number;
    ARS: number;

    // Pares cruzados en formato P2P
    USD_USD: ExchangeRatePair;
    USD_EUR: ExchangeRatePair;
    USD_ARS: ExchangeRatePair;
    EUR_USD: ExchangeRatePair;
    EUR_EUR: ExchangeRatePair;
    EUR_ARS: ExchangeRatePair;
    ARS_USD: ExchangeRatePair;
    ARS_EUR: ExchangeRatePair;
    ARS_ARS: ExchangeRatePair;

    // Firma de índice para admitir el acceso por strings dinámicos de monedas
    [key: string]: number | ExchangeRatePair | undefined;
}

interface ExchangeRateCacheState {
    rates: ExchangeRates;
    fetchedAt: number;
}

let ratesCache: ExchangeRateCacheState | null = null;
let activeRefreshPromise: Promise<ExchangeRates> | null = null;

/**
 * Obtiene las tasas de cambio vigentes directamente desde la caché.
 * Si la caché está vacía (por ejemplo, en el arranque inicial del servidor), 
 * fuerza una carga inicial antes de responder.
 * 
 * Si ya hay una carga en progreso, reutiliza la promesa activa para evitar 
 * consultas redundantes paralelas.
 */
export async function getExchangeRates(): Promise<ExchangeRates> {
    if (ratesCache) {
        return ratesCache.rates;
    }

    if (activeRefreshPromise) {
        console.log("[Exchange Service] Carga inicial ya en progreso, esperando promesa activa...");
        return await activeRefreshPromise;
    }

    console.warn("[Exchange Service] Caché vacía. Iniciando carga forzada inicial...");
    return await updateExchangeRatesCache();
}

/**
 * Realiza la consulta a las APIs externas para actualizar la caché en memoria.
 * Intenta con Frankfurter v2 y tiene fallback a ExchangeRate-API.
 * 
 * Utiliza tiempos de espera (timeouts) de 5 segundos y evita llamadas 
 * concurrentes compartiendo la promesa en curso.
 */
export async function updateExchangeRatesCache(): Promise<ExchangeRates> {
    if (activeRefreshPromise) {
        return activeRefreshPromise;
    }

    activeRefreshPromise = (async () => {
        try {
            // 1. Proveedor Principal: Frankfurter v2 con timeout
            const response = await fetch("https://api.frankfurter.dev/v2/rates", {
                signal: AbortSignal.timeout(5000)
            });
            if (!response.ok) {
                throw new Error(`Frankfurter v2 respondió con estado ${response.status}`);
            }

            const data = await response.json();
            if (!Array.isArray(data)) {
                throw new Error("La respuesta de Frankfurter v2 no es un array válido");
            }

            let eurToUsd: number | undefined;
            let eurToArs: number | undefined;

            for (const entry of data) {
                if (entry && typeof entry === "object" && entry.base === "EUR") {
                    if (entry.quote === "USD" && entry.rate !== undefined) {
                        eurToUsd = Number(entry.rate);
                    } else if (entry.quote === "ARS" && entry.rate !== undefined) {
                        eurToArs = Number(entry.rate);
                    }
                }
            }

            if (!eurToUsd || !Number.isFinite(eurToUsd) || eurToUsd <= 0) {
                throw new Error("La API no devolvió la cotización de USD");
            }
            if (!eurToArs || !Number.isFinite(eurToArs) || eurToArs <= 0) {
                throw new Error("La API no devolvió la cotización de ARS");
            }

            const rawRates = {
                USD: 1.0,
                EUR: 1.0 / eurToUsd,
                ARS: eurToArs / eurToUsd
            };

            return procesarYGuardarCache(rawRates);

        } catch (primaryError: any) {
            console.warn(`[Exchange Service] Proveedor principal falló. Iniciando Fallback... (${primaryError.message})`);

            try {
                // 2. Proveedor de Respaldo: ExchangeRate-API con timeout
                const fallbackResponse = await fetch("https://open.er-api.com/v6/latest/USD", {
                    signal: AbortSignal.timeout(5000)
                });
                if (!fallbackResponse.ok) {
                    throw new Error(`ExchangeRate-API respondió con estado ${fallbackResponse.status}`);
                }

                const fallbackData = (await fallbackResponse.json()) as any;
                if (!fallbackData || !fallbackData.rates) {
                    throw new Error("Respuesta inválida de ExchangeRate-API");
                }

                const eurRate = Number(fallbackData.rates.EUR);
                const arsRate = Number(fallbackData.rates.ARS);

                if (!eurRate || !Number.isFinite(eurRate) || eurRate <= 0) {
                    throw new Error("La API de respaldo no devolvió la cotización de EUR");
                }
                if (!arsRate || !Number.isFinite(arsRate) || arsRate <= 0) {
                    throw new Error("La API de respaldo no devolvió la cotización de ARS");
                }

                const rawRates = {
                    USD: 1.0,
                    EUR: eurRate,
                    ARS: arsRate
                };

                return procesarYGuardarCache(rawRates);

            } catch (fallbackError: any) {
                console.error(`[Exchange Service] Fallo Crítico: Ambos proveedores cayeron. (${fallbackError.message})`);

                // Si ya hay un historial en caché, lo mantenemos para evitar la caída del servidor.
                if (ratesCache) {
                    console.warn("[Exchange Service] Devolviendo caché en memoria existente debido a fallas de red.");
                    return ratesCache.rates;
                }

                throw new Error("Imposible realizar cotización porque las cotizaciones se cayeron o no hay forma de cotizar");
            }
        }
    })();

    try {
        return await activeRefreshPromise;
    } finally {
        activeRefreshPromise = null;
    }
}

/**
 * Procesa las tasas relativas a USD y genera todas las combinaciones directas, 
 * inversas y cruzadas (P2P-compatible y compatible con compras/ventas estándar).
 */
function procesarYGuardarCache(rawRates: { USD: number; EUR: number; ARS: number }): ExchangeRates {
    const eurRate = rawRates.EUR;
    const arsRate = rawRates.ARS;

    const nextRates: ExchangeRates = {
        USD: 1.0,
        EUR: eurRate,
        ARS: arsRate,

        // Pares cruzados y formatos P2P
        USD_USD: { value: 1.0 },
        USD_EUR: { value: eurRate },
        USD_ARS: { value: arsRate },

        EUR_USD: { value: 1.0 / eurRate },
        EUR_EUR: { value: 1.0 },
        EUR_ARS: { value: arsRate / eurRate },

        ARS_USD: { value: 1.0 / arsRate },
        ARS_EUR: { value: eurRate / arsRate },
        ARS_ARS: { value: 1.0 }
    };

    ratesCache = {
        rates: nextRates,
        fetchedAt: Date.now()
    };

    return ratesCache.rates;
}

// Configurar el arranque e intervalo en segundo plano (omitido en ambiente de pruebas para evitar colgar el recolector de hilos)
if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
    updateExchangeRatesCache().catch((err) => {
        console.error("[Exchange Service] Error al realizar la carga inicial de cotizaciones:", err);
    });

    const refreshInterval = setInterval(() => {
        console.log("[Exchange Service] Actualizando caché de cotizaciones en segundo plano...");
        updateExchangeRatesCache().catch((err) => {
            console.error("[Exchange Service] Falló la actualización de cotizaciones en segundo plano:", err);
        });
    }, 2 * 60 * 60 * 1000);
    refreshInterval.unref?.();
}