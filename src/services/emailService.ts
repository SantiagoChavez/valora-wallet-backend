import { emailRegex } from "../utils/emailValidation.js";

/**
 * Redacta la parte local de un email para logging, dejando solo el dominio (ej. "usuario@mail.com" -> "***@mail.com").
 */
function redactEmail(email: string): string {
  const atIndex = email.indexOf("@");
  return atIndex === -1 ? "***" : `***${email.slice(atIndex)}`;
}

export interface EmailConfirmacionParams {
  destinatario: string;
  asunto: string;
  cuerpoHtml: string;
}

/**
 * Envía un email transaccional vía Brevo HTTPS REST API.
 * @param params - Destinatario, asunto y cuerpo HTML del email.
 * @returns El id del mensaje devuelto por Brevo.
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

  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("La variable de entorno BREVO_API_KEY no está configurada.");
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim() || "chavezsantiago480@gmail.com";
  const senderName = process.env.BREVO_SENDER_NAME?.trim() || "Valora Wallet";

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: destinatarioNormalizado }],
        subject: asunto,
        htmlContent: cuerpoHtml,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      messageId?: string;
      message?: string;
      code?: string;
    };

    if (!response.ok) {
      throw new Error(data.message || `Error de Brevo API (${response.status})`);
    }

    const messageId = data.messageId || "sent";

    if (process.env.NODE_ENV !== "production") {
      console.log("Email de confirmación enviado vía Brevo", {
        destinatario: redactEmail(destinatarioNormalizado),
        messageId,
      });
    }

    return messageId;
  } catch (error) {
    console.error("Fallo al enviar email de confirmación vía Brevo", {
      destinatario: redactEmail(destinatarioNormalizado),
      error: error instanceof Error ? { name: error.name, message: error.message } : error,
    });
    throw error;
  }
}
