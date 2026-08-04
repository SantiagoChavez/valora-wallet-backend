interface ExchangeApiResponse {
    amount: number;
    base: string;
    date: string;
    rates: Record<string, number>;
}

interface ExchangeRateCacheState {
    rates: Record<string, number>;
    fetchedAt: number;
}

let ratesCache: ExchangeRateCacheState | null = null;
let lastFetchTime: number = 0;

// Constante de tiempo: 1 hora en milisegundos
const CACHE_TTL = 60 * 60 * 1000;

export async function getExchangeRates(): Promise<Record<string, number>> {
    const now = Date.now();

    if (ratesCache && (now - ratesCache.fetchedAt) < CACHE_TTL) {
        return ratesCache.rates;
    }

    try {
        const response = await fetch("https://api.frankfurter.app/latest?from=USD");

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = (await response.json()) as ExchangeApiResponse;

        const nextRates: Record<string, number> = { USD: 1 };

        if (typeof data.rates.EUR === "number" && Number.isFinite(data.rates.EUR)) {
            nextRates.EUR = data.rates.EUR;
        }

        if (typeof data.rates.ARS === "number" && Number.isFinite(data.rates.ARS)) {
            nextRates.ARS = data.rates.ARS;
        }

        ratesCache = {
            rates: nextRates,
            fetchedAt: Date.now(),
        };
        lastFetchTime = Date.now();

        return ratesCache.rates;
    } catch (error: unknown) {
        const hasFreshCache = ratesCache !== null && (Date.now() - ratesCache.fetchedAt) < CACHE_TTL;

        if (hasFreshCache && ratesCache) {
            console.warn("[Exchange Service] La API falló; se está devolviendo una caché válida pero potencialmente obsoleta.");
            return ratesCache.rates;
        }

        throw new Error("No se pudieron obtener las tasas de cambio en este momento");
    }
}