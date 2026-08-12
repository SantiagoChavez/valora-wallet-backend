import { GoogleGenerativeAI } from "@google/generative-ai";
import { getChatHistoryByUserId, saveChatMessage } from "../models/chatbotModel.js";

let genAIClient: GoogleGenerativeAI | null = null;

function getGenAIClient(): GoogleGenerativeAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("La variable de entorno GEMINI_API_KEY no está configurada.");
    }
    genAIClient = new GoogleGenerativeAI(apiKey);
  }
  return genAIClient;
}

type FinancialAdviceContext = {
  transactions?: unknown;
  exchangeRatesResult?: unknown;
};

const MAX_TRANSACTIONS_FOR_CONTEXT = 10;
const MAX_STRING_LENGTH = 120;

function trimString(value: unknown, maxLength = MAX_STRING_LENGTH): string {
  const asString = typeof value === "string" ? value : String(value ?? "");
  return asString.length > maxLength
    ? `${asString.slice(0, maxLength)}...`
    : asString;
}

function safeJsonStringify(value: unknown, fallback = "{}"): string {
  try {
    const serialized = JSON.stringify(value);
    return serialized ?? fallback;
  } catch {
    return fallback;
  }
}

function sanitizeTransactionsForContext(input: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(input)) return [];

  return input.slice(0, MAX_TRANSACTIONS_FOR_CONTEXT).map((tx) => {
    if (!tx || typeof tx !== "object") {
      return { resumen: trimString(tx) };
    }

    const raw = tx as Record<string, unknown>;

    return {
      fecha: raw.createdAt ?? raw.date ?? raw.timestamp ?? null,
      tipo: raw.type ?? raw.kind ?? null,
      monto: raw.amount ?? null,
      moneda: raw.currency ?? null,
      estado: raw.status ?? null,
      descripcion:
        raw.description !== undefined ? trimString(raw.description) : undefined,
      categoria: raw.category ?? undefined,
    };
  });
}

function sanitizeExchangeRatesForContext(input: unknown): unknown {
  if (!input || typeof input !== "object") return {};

  const entries = Object.entries(input as Record<string, unknown>).slice(0, 30);
  const compact = Object.fromEntries(entries);
  return compact;
}

/**
 * Genera asesoramiento financiero utilizando IA.
 * 
 * @architecture Se integra intencionalmente con el módulo de transacciones mediante
 * el parámetro `context`. Este acoplamiento transversal permite a la IA proveer
 * insights basados en el historial reciente de transacciones y tasas de cambio.
 */
export async function getFinancialAdvice(
  userId: string,
  userMessage: string,
  balances: Record<string, number>,
  context?: FinancialAdviceContext
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

  const sanitizedTransactions = sanitizeTransactionsForContext(context?.transactions);
  const sanitizedExchangeRates = sanitizeExchangeRatesForContext(
    context?.exchangeRatesResult
  );

  const contextData = `
Saldos actuales del usuario: ${safeJsonStringify(balances, "{}")}
Cotizaciones actuales (si están disponibles): ${safeJsonStringify(sanitizedExchangeRates, "{}")}
Últimas transacciones (resumen limitado): ${safeJsonStringify(sanitizedTransactions, "[]")}
  `;

  const fullSystemInstruction = `${systemPrompt}\n\n${contextData}`;

  try {
    const genAI = getGenAIClient();
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-lite",
      systemInstruction: fullSystemInstruction,
    });

    const dbHistory = await getChatHistoryByUserId(userId);
    const geminiHistory = dbHistory.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.message }],
    }));

    const chat = model.startChat({
      history: geminiHistory,
    });

    const result = await chat.sendMessage(userMessage);
    const responseText = result.response.text();

    await saveChatMessage(userId, "user", userMessage);
    await saveChatMessage(userId, "model", responseText);

    return responseText;
  } catch (error: unknown) {
    console.error("[Gemini Service] Error al generar contenido:", error);
    throw new Error("El asistente financiero no está disponible en este momento.");
  }
}