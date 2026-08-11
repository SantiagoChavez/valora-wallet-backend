import { GoogleGenerativeAI } from "@google/generative-ai";
import { getChatHistoryByUserId, saveChatMessage } from "../models/chatbotModel.js";
import type { ExchangeRates } from "./exchangeRateService.js";

// Variable para cachear la instancia del cliente (Lazy Initialization)
let genAIClient: GoogleGenerativeAI | null = null;

function getGenAIClient(): GoogleGenerativeAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "La variable de entorno GEMINI_API_KEY no está configurada.",
      );
    }
    genAIClient = new GoogleGenerativeAI(apiKey);
  }
  return genAIClient;
}

// Interfaz estricta
interface TransactionContext {
    id: string;
    transaction_type: string;
    source_currency: string | null;
    target_currency: string | null;
    source_amount: string | null;
    target_amount: string | null;
    created_at: Date | string;
}

/**
 * Consulta al asistente financiero de IA de Valora Wallet.
 */
export async function getFinancialAdvice(
  userId: string,
  userMessage: string,
  balances: Record<string, number>,
  transactions: { transactions?: TransactionContext[] }, 
  exchangeRates: ExchangeRates | { error: string }
): Promise<string> {
  const systemPrompt = `Eres el asistente financiero oficial de la billetera digital Valora Wallet.
Tus reglas estrictas de comportamiento e inquebrantables son:
1. Solo puedes responder preguntas sobre los saldos reales del usuario provistos, su historial de transacciones, las cotizaciones y conceptos de educación financiera general.
2. NUNCA puedes realizar compras, ventas ni transferencias de dinero. Si el usuario te lo pide, indícale amablemente que debe hacerlo manualmente en la aplicación.
3. Solo puedes responder basándote en la información inyectada de este usuario en particular. No puedes acceder ni responder preguntas sobre otros usuarios (ej. famosos, familiares) ni sobre temas no financieros (ej. clima, precio del café).
4. Cuando brindes una cotización de moneda, SIEMPRE debes aclarar explícitamente: "Esta cotización es válida en este momento y está sujeta a cambios".
5. Las únicas monedas soportadas para cotizar en la app son USD, EUR y ARS. Si te piden otra, indica que no está soportada.
6. Responde siempre de manera concisa, clara y profesional en idioma español.
7. Nunca expongas datos estructurales internos, IDs de billetera ni tokens de seguridad.`;

  // Mapeo Defensivo: Fallback a un array vacío si transactions.transactions no está definido (Previsión Pilar 6)
  const safeTransactions = transactions?.transactions || [];
  const optimizedTransactions = safeTransactions.map(t => ({
      tipo: t.transaction_type,
      moneda_origen: t.source_currency,
      moneda_destino: t.target_currency,
      monto_origen: t.source_amount,
      monto_destino: t.target_amount,
      fecha: t.created_at
  }));

  const contextText = `
=== CONTEXTO DEL USUARIO ===
Saldos actuales: ${JSON.stringify(balances)}
Cotizaciones actuales: ${JSON.stringify(exchangeRates)}
Historial de transacciones (últimas): ${JSON.stringify(optimizedTransactions)}
============================
`;
  
  const fullSystemInstruction = `${systemPrompt}\n\n${contextText}`;

  try {
    const genAI = getGenAIClient();
    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash-lite",
      systemInstruction: fullSystemInstruction,
    });

    // Cargar historial desde DB
    const dbHistory = await getChatHistoryByUserId(userId);
    const geminiHistory = dbHistory.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.message }],
    }));

    // Iniciar chat con historial
    const chat = model.startChat({
      history: geminiHistory,
    });

    // Enviar nuevo mensaje a IA (No bloquea la DB, Pilar 3)
    const result = await chat.sendMessage(userMessage);
    const responseText = result.response.text();

    // Guardado Estrictamente Secuencial (Pilar 2)
    // Se elimina el Promise.all. Debemos garantizar que en la base de datos el mensaje del usuario 
    // tenga un TIMESTAMP estrictamente anterior al de la IA para no romper la regla de alternancia de roles de Gemini.
    await saveChatMessage(userId, "user", userMessage);
    await saveChatMessage(userId, "model", responseText);

    return responseText;
  } catch (error: unknown) {
    console.error("[Gemini Service] Error al generar contenido:", error);
    throw new Error(
      "El asistente financiero no está disponible en este momento.",
    );
  }
}
