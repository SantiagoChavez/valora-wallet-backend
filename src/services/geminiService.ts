import { GoogleGenerativeAI } from "@google/generative-ai";

// Variable para cachear la instancia del cliente (Lazy Initialization)
let genAIClient: GoogleGenerativeAI | null = null;

function getGenAIClient(): GoogleGenerativeAI {
    if (!genAIClient) {
        // 1. Inicialización: Verificamos y obtenemos la API key desde las variables de entorno de forma perezosa
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("La variable de entorno GEMINI_API_KEY no está configurada.");
        }
        // Instanciamos el cliente de Google Generative AI
        genAIClient = new GoogleGenerativeAI(apiKey);
    }
    return genAIClient;
}

/**
 * Consulta al asistente financiero de IA de Valora Wallet.
 * @param userMessage El mensaje original del usuario.
 * @param balances Un objeto con los saldos actuales del usuario.
 * @returns La respuesta generada por Gemini en formato texto.
 */
export async function getFinancialAdvice(userMessage: string, balances: Record<string, number>): Promise<string> {
    // 2. System Prompt & Anti-injection nativo
    const systemPrompt = "Eres el asistente financiero de Valora Wallet. Solo puedes hablar de los saldos del usuario y de finanzas. No respondas a otras temáticas.";

    // 3. Inyección de datos al rol de sistema: Convertimos los saldos a texto plano
    const balancesText = `Saldos actuales del usuario: ${JSON.stringify(balances)}`;
    const fullSystemInstruction = `${systemPrompt}\n\n${balancesText}`;

    try {
        // 4. Instanciamos el modelo asignando el systemInstruction protegido
        const genAI = getGenAIClient();
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: fullSystemInstruction
        });

        // 5. Retorno: Ejecutamos el llamado al modelo pasando únicamente el mensaje del usuario
        const result = await model.generateContent(userMessage);
        const response = await result.response;

        // Retornamos exclusivamente el texto generado
        return response.text();
    } catch (error) {
        console.error("[Gemini Service] Error al generar contenido:", error);
        throw new Error("El asistente financiero no está disponible en este momento.");
    }
}