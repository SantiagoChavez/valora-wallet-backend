import { Resend } from "resend";
import { emailRegex } from "../utils/emailValidation.js";

/**
 * Redacta la parte local de un email para logging, dejando solo el dominio (ej. "usuario@mail.com" -> "***@mail.com").
 */
function redactEmail(email: string): string {
  const atIndex = email.indexOf("@");
  return atIndex === -1 ? "***" : `***${email.slice(atIndex)}`;
}

let resendClient: Resend | undefined;

/**
 * Inicializa y devuelve la instancia del cliente de Resend (singleton),
 * validando que la variable de entorno RESEND_API_KEY esté configurada.
 */
function getResendClient(): Resend {
  if (resendClient) {
    return resendClient;
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("La variable de entorno RESEND_API_KEY no está configurada.");
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

export interface EmailConfirmacionParams {
  destinatario: string;
  asunto: string;
  cuerpoHtml: string;
}

/**
 * Envía un email transaccional vía Resend HTTPS REST API.
 * @param params - Destinatario, asunto y cuerpo HTML del email.
 * @returns El id del mensaje devuelto por Resend.
 */
export async function enviarEmailConfirmacion({
  destinatario,
  asunto,
  cuerpoHtml,
}: EmailConfirmacionParams): Promise<string> {
  const destinatarioNormalizado = destinatario.trim();

  if (!emailRegex.test(destinatarioNormalizado)) {
    throw new Error("El email del destinatario provisto no tiene un formato válido.");
  }
  if (!asunto.trim()) {
    throw new Error("El asunto del email no puede estar vacío.");
  }
  if (!cuerpoHtml.trim()) {
    throw new Error("El cuerpo del email no puede estar vacío.");
  }

  const client = getResendClient();

  try {
    const { data, error } = await client.emails.send({
      from: "Valora Wallet <onboarding@resend.dev>",
      to: [destinatarioNormalizado],
      subject: asunto,
      html: cuerpoHtml,
    });

    if (error) {
      throw new Error(error.message);
    }

    const messageId = data?.id || "sent";

    if (process.env.NODE_ENV !== "production") {
      console.log("Email de confirmación enviado vía Resend", {
        destinatario: redactEmail(destinatarioNormalizado),
        messageId,
      });
    }

    return messageId;
  } catch (error) {
    console.error("Fallo al enviar email de confirmación vía Resend", {
      destinatario: redactEmail(destinatarioNormalizado),
      error: error instanceof Error ? { name: error.name, message: error.message } : error,
    });
    throw error;
  }
}
