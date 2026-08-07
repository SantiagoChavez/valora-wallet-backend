import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. Inicialización: Verificamos y obtenemos la API key desde las variables de entorno
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    throw new Error("La variable de entorno GEMINI_API_KEY no está configurada.");
}

// Instanciamos el cliente de Google Generative AI
const genAI = new GoogleGenerativeAI(apiKey);

// Seleccionamos explícitamente el modelo indicado en los requerimientos
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

/**
 * Consulta al asistente financiero de IA de Valora Wallet.
 * @param userMessage El mensaje original del usuario.
 * @param balances Un objeto con los saldos actuales del usuario.
 * @returns La respuesta generada por Gemini en formato texto.
 */
export async function getFinancialAdvice(userMessage: string, balances: Record<string, number>): Promise<string> {
    // 2. System Prompt & Anti-injection
    const systemPrompt = "Eres el asistente financiero de Valora Wallet. Solo puedes hablar de los saldos del usuario y de finanzas. No respondas a otras temáticas.";

    // 3. Inyección de datos: Convertimos los saldos a texto plano
    const balancesText = `Saldos actuales del usuario: ${JSON.stringify(balances)}`;

    // 4. Implementación del Prompt: Concatenación estricta
    const finalPrompt = `${systemPrompt}\n\n${balancesText}\n\nMensaje del usuario: ${userMessage}`;

    try {
        // 5. Retorno: Ejecutamos el llamado al modelo de IA
        const result = await model.generateContent(finalPrompt);
        const response = await result.response;

        // Retornamos exclusivamente el texto generado
        return response.text();
    } catch (error) {
        console.error("[Gemini Service] Error al generar contenido:", error);
        throw new Error("El asistente financiero no está disponible en este momento.");
    }
}