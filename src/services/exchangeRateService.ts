// Paso 1: Definicion de Tipos y Estructura de Cache

// Interfaz para la respuesta esperada de la API externa 

interface ExchangeApiResponse{
    amount: number;
    base: string;
    date: string;
    rates: Record<string, number>;
}

// Variables globales del módulo que vivirán en la memoria de Railway
let ratesCache: Record<string, number> | null = null;
let lastFetchTime: number = 0;
let lastSuccessfulFetchTime: number = 0;

// Constante de tiempo: 1 hora en milisegundos
const CACHE_TTL = 60 * 60 * 1000;

// Paso 2: Creaciond ela Funcion y VAlidacion de Cache (Early Return)
export async function getExchangeRates(): Promise<Record<string, number>>{
    const now = Date.now();

    // Si la caché sigue siendo válida y ya se obtuvo al menos una vez, la devolvemos como resultado fresco.
    if (ratesCache && lastSuccessfulFetchTime > 0 && (now - lastSuccessfulFetchTime) < CACHE_TTL){
        return ratesCache;
    }

    // Paso 3: Consumo de la API Externa y Wrapper
    try{
        // Usamos fetch nativo (Node +18) para llamar a la API
        const response = await fetch('https://api.frankfurter.app/latest?from=USD');

        // Validacion de Status HTTP
        if (!response.ok){
            throw new Error(`HTTP Error: ${response.status}`);
        }

        // Paso 5: Parseo (DTO) y Actualizacion de Estado
        const data = (await response.json()) as ExchangeApiResponse;

        // Transformación (DTO): Extraemos únicamente las tasas que manejará la billetera.
        // Nota: Como la base es USD, Frankfurter no la incluye en 'rates', así que la agregamos manualmente.
        // Si la API no devuelve una tasa válida para EUR o ARS, no la cacheamos para evitar valores inventados.
        const nextRates: Record<string, number> = { USD: 1 };

        if (typeof data.rates.EUR === "number" && Number.isFinite(data.rates.EUR)) {
            nextRates.EUR = data.rates.EUR;
        }

        if (typeof data.rates.ARS === "number" && Number.isFinite(data.rates.ARS)) {
            nextRates.ARS = data.rates.ARS;
        }

        ratesCache = nextRates;

        // Actualizamos el temporizador de la ultima llamada exitosa
        lastSuccessfulFetchTime = Date.now();
        lastFetchTime = Date.now();

        return ratesCache;

    } catch (error: unknown) {
        // Si hay una respuesta previa válida, la devolvemos solo como fallback explícito.
        if (ratesCache && lastSuccessfulFetchTime > 0) {
            console.warn("[Exchange Service] La API falló; se está devolviendo la caché válida anterior.");
            return ratesCache;
        }

        // Paso 4: Exepciones Controladas (Manejo Centralizado)
        // Si la API falla por completo y no hay una caché válida previa, se rechaza la operación.
        throw new Error("No se pudieron obtener las tasas de cambio en este momento");
    }
}