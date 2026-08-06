import "dotenv/config";
import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";

// Regex estándar de email, misma usada en authSchema.ts
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Redacta la parte local de un email para logging, dejando solo el dominio (ej. "usuario@mail.com" -> "***@mail.com").
 */
function redactEmail(email: string): string {
  const atIndex = email.indexOf("@");
  return atIndex === -1 ? "***" : `***${email.slice(atIndex)}`;
}

let client: SESClient | undefined;

/**
 * Crea (una sola vez) y devuelve el cliente de AWS SES, validando las variables de entorno requeridas.
 * @returns El cliente SES listo para usar.
 */
function getSesClient(): SESClient {
  if (client) {
    return client;
  }

  const region = process.env.AWS_SES_REGION;
  if (!region) {
    throw new Error("La variable de entorno AWS_SES_REGION no está configurada.");
  }

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  // Si no se proveen credenciales explícitas, el SDK cae al default credential
  // provider chain (rol IAM en EC2/ECS/Lambda, SSO, perfil de ~/.aws, etc.).
  client = new SESClient({
    region,
    ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
  });

  return client;
}

/**
 * Obtiene y valida el email remitente verificado en SES.
 * @returns El email remitente.
 */
function getSenderEmail(): string {
  const senderEmail = process.env.AWS_SES_SENDER_EMAIL;
  if (!senderEmail) {
    throw new Error("La variable de entorno AWS_SES_SENDER_EMAIL no está configurada.");
  }
  return senderEmail;
}

export interface EmailConfirmacionParams {
  destinatario: string;
  asunto: string;
  cuerpoHtml: string;
}

/**
 * Envía un email de confirmación transaccional vía AWS SES.
 * @param params - Destinatario, asunto y cuerpo HTML del email.
 * @returns El messageId devuelto por SES.
 */
export async function enviarEmailConfirmacion({
  destinatario,
  asunto,
  cuerpoHtml,
}: EmailConfirmacionParams): Promise<string> {
  if (!emailRegex.test(destinatario)) {
    throw new Error("El email del destinatario provisto no tiene un formato válido.");
  }
  if (!asunto.trim()) {
    throw new Error("El asunto del email no puede estar vacío.");
  }
  if (!cuerpoHtml.trim()) {
    throw new Error("El cuerpo del email no puede estar vacío.");
  }

  const sesClient = getSesClient();

  const command = new SendEmailCommand({
    Source: getSenderEmail(),
    Destination: { ToAddresses: [destinatario] },
    Message: {
      Subject: { Data: asunto, Charset: "UTF-8" },
      Body: { Html: { Data: cuerpoHtml, Charset: "UTF-8" } },
    },
  });

  try {
    const res = await sesClient.send(command);
    if (!res.MessageId) {
      throw new Error("SES no devolvió un MessageId para el email enviado.");
    }
    console.log("Email de confirmación enviado", {
      destinatario: redactEmail(destinatario),
      messageId: res.MessageId,
    });
    return res.MessageId;
  } catch (error) {
    console.error("Fallo al enviar email de confirmación vía SES", {
      destinatario: redactEmail(destinatario),
      error,
    });
    throw error;
  }
}
